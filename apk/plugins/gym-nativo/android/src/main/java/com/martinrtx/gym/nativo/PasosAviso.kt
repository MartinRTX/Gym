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

    /** La siguiente revisión: hoy a la hora elegida o, si ya pasó, mañana. Se vuelve a poner cada vez. */
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
        var cuando = LocalDate.now().atTime(p.getInt("pasos_hora", 17), p.getInt("pasos_min", 0))
        if (!cuando.isAfter(LocalDateTime.now())) cuando = cuando.plusDays(1)
        val ms = cuando.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, pi)
        p.edit().putLong("pasos_proximo", ms).apply()
    }

    private fun anotar(c: Context, r: String) {
        Widgets.prefs(c).edit().putString("pasos_resultado", LocalDateTime.now().withNano(0).toString() + " " + r).apply()
    }

    suspend fun revisar(c: Context) {
        val p = Widgets.prefs(c)
        if (!p.getBoolean("pasos_activo", false)) return
        val hoy = LocalDate.now()
        if (p.getString("pasos_ultimo", "") == hoy.toString()) return
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
        avisar(c, texto)
        anotar(c, texto)
    }

    private fun avisar(c: Context, texto: String) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
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
    }
}

/** La alarma de la hora del aviso y el reinicio del celular (las alarmas se borran al apagarlo). */
class PasosReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, intent: Intent) {
        val app = c.applicationContext
        val pendiente = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (intent.action == PasosAviso.ACCION) withTimeoutOrNull(8000) { PasosAviso.revisar(app) }
            } catch (e: Exception) {
                // Sin Health Connect o sin permiso: no se avisa y se intenta mañana
            } finally {
                PasosAviso.programar(app)
                pendiente.finish()
            }
        }
    }
}
