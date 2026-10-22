package com.martinrtx.gym.nativo

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject

/**
 * Aviso de pasos contra el trabajo de escritorio: a la hora elegida (5 pm) revisa tus pasos en Health Connect y,
 * si vas atrasado para tu meta del día, avisa: "Son las 5 pm y llevas 3,200 pasos: camina 15 minutos".
 * Funciona con la app cerrada solo si en Health Connect diste "Acceder a datos en segundo plano".
 */
object PasosAviso {

    const val ACCION = "com.martinrtx.gym.nativo.REVISAR_PASOS"
    private const val CANAL = "pasos"
    private const val ID_NOTI = 601

    @JvmStatic
    fun configurar(c: Context, activo: Boolean, meta: Int, hora: Int, minuto: Int, laborales: Boolean) {
        Widgets.prefs(c).edit()
            .putBoolean("pasos_activo", activo)
            .putInt("pasos_meta", meta.coerceIn(1000, 30000))
            .putInt("pasos_hora", hora.coerceIn(9, 21))
            .putInt("pasos_min", minuto.coerceIn(0, 59))
            .putBoolean("pasos_laborales", laborales)
            .apply()
        programar(c)
    }

    @JvmStatic
    fun config(c: Context): JSONObject {
        val p = Widgets.prefs(c)
        return JSONObject()
            .put("activo", p.getBoolean("pasos_activo", false))
            .put("meta", p.getInt("pasos_meta", 7000))
            .put("hora", p.getInt("pasos_hora", 17))
            .put("min", p.getInt("pasos_min", 0))
            .put("laborales", p.getBoolean("pasos_laborales", true))
            .put("proximo", p.getLong("pasos_proximo", 0))
            .put("ultimo", p.getString("pasos_ultimo", ""))
            .put("resultado", p.getString("pasos_resultado", ""))
    }

    private fun alarma(c: Context): PendingIntent {
        val i = Intent(c, PasosReceiver::class.java).setAction(ACCION)
        return PendingIntent.getBroadcast(c, 602, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /**
     * La siguiente revisión: hoy a la hora elegida o, si ya pasó, mañana. Se vuelve a poner cada vez.
     * Si la hora de hoy pasó hace menos de 2 h y hoy no se ha revisado (abriste la app justo antes de que sonara), en 1 minuto.
     * Exacta si Android lo permite ("Alarmas y recordatorios"); si no, inexacta (puede llegar hasta ~1 h después).
     */
    @JvmStatic
    fun programar(c: Context) {
        val p = Widgets.prefs(c)
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val pi = alarma(c)
        am.cancel(pi)
        if (!p.getBoolean("pasos_activo", false)) {
            p.edit().putLong("pasos_proximo", 0).apply()
            return
        }
        val ahora = LocalDateTime.now()
        val hoy = LocalDate.now().atTime(p.getInt("pasos_hora", 17), p.getInt("pasos_min", 0))
        val cuando = when {
            hoy.isAfter(ahora) -> hoy
            p.getString("pasos_revisado", "") != LocalDate.now().toString() && hoy.plusHours(2).isAfter(ahora) -> ahora.plusMinutes(1)
            else -> hoy.plusDays(1)
        }
        val ms = cuando.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi)
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi)
        p.edit().putLong("pasos_proximo", ms).apply()
    }

    @JvmStatic
    fun anotar(c: Context, r: String) {
        Widgets.prefs(c).edit().putString("pasos_resultado", LocalDateTime.now().withNano(0).toString() + " " + r).apply()
    }

    suspend fun revisar(c: Context) {
        val p = Widgets.prefs(c)
        if (!p.getBoolean("pasos_activo", false)) return
        val hoy = LocalDate.now()
        if (p.getString("pasos_ultimo", "") == hoy.toString()) return
        p.edit().putString("pasos_revisado", hoy.toString()).apply()   // hoy ya se intentó (aunque no haya datos)
        if (p.getBoolean("pasos_laborales", true) && hoy.dayOfWeek.value >= 6) return anotar(c, "fin de semana")
        val leidos: Long? = try {
            SaludNativa.pasosHoy(c)
        } catch (e: SecurityException) {
            return anotar(c, "sin permiso en segundo plano")
        }
        val pasos = leidos ?: return anotar(c, "sin datos de pasos hoy")
        p.edit().putString("pasos_ultimo", hoy.toString()).apply()
        val meta = p.getInt("pasos_meta", 7000)
        val t = LocalTime.now()
        // Lo esperado a esta hora si repartes la meta de 7 am a 10 pm
        val esperado = (meta * (t.hour + t.minute / 60.0 - 7.0) / 15.0).coerceIn(0.0, meta.toDouble())
        if (pasos >= esperado) return anotar(c, "$pasos pasos: vas bien")
        // ~100 pasos por minuto caminando; de 10 a 30 minutos, en múltiplos de 5
        val minutos = (((esperado - pasos) / 100.0 / 5.0).roundToInt() * 5).coerceIn(10, 30)
        val hora = (if (t.hour % 12 == 0) 12 else t.hour % 12).toString() +
            (if (t.minute > 0) String.format(Locale.US, ":%02d", t.minute) else "") + (if (t.hour < 12) " am" else " pm")
        val texto = "Son las $hora y llevas ${String.format(Locale.US, "%,d", pasos)} pasos: camina $minutos minutos"
        anotar(c, if (avisar(c, texto)) texto else "$texto (no salió: notificaciones apagadas para Gym)")
    }

    @JvmStatic
    fun notificacionesActivas(c: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val nm = c.getSystemService(NotificationManager::class.java) ?: return false
        if (!nm.areNotificationsEnabled()) return false
        val canal = nm.getNotificationChannel(CANAL)
        return canal == null || canal.importance != NotificationManager.IMPORTANCE_NONE
    }

    /** true si la notificación salió (con permiso, notificaciones de la app y el canal de pasos prendidos). */
    private fun avisar(c: Context, texto: String): Boolean {
        if (!notificacionesActivas(c)) return false
        val nm = c.getSystemService(NotificationManager::class.java) ?: return false
        if (nm.getNotificationChannel(CANAL) == null) {
            nm.createNotificationChannel(NotificationChannel(CANAL, "Aviso de pasos", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val n = Notification.Builder(c, CANAL)
            .setSmallIcon(R.drawable.ic_noti_pasos)
            .setContentTitle("Muévete un poco")
            .setContentText(texto)
            .setStyle(Notification.BigTextStyle().bigText(texto))
            .setContentIntent(Widgets.abrir(c, "pasos", ID_NOTI))
            .setAutoCancel(true)
            .build()
        nm.notify(ID_NOTI, n)
        return true
    }
}

/** La alarma de la hora del aviso, el reinicio del celular (las alarmas se borran al apagarlo) y cambios de hora o zona. */
class PasosReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        val app = c.applicationContext
        val pendiente = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (intent.action == PasosAviso.ACCION && withTimeoutOrNull(8000) { PasosAviso.revisar(app) } == null) {
                    PasosAviso.anotar(app, "Health Connect tardó demasiado; se intenta mañana")
                }
            } catch (e: Exception) {
                // Sin Health Connect o sin permiso: no se avisa y se intenta mañana (queda anotado para el diagnóstico)
                PasosAviso.anotar(app, "error: " + (e.message ?: e.javaClass.simpleName))
            } finally {
                PasosAviso.programar(app)
                pendiente.finish()
            }
        }
    }
}
