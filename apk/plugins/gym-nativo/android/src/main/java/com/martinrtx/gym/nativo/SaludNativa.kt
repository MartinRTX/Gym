package com.martinrtx.gym.nativo

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** Lo que la app recibe de lo nativo (Java lo usa con una lambda). */
fun interface Respuesta {
    fun listo(r: JSONObject)
}

/**
 * Health Connect solo lectura, hecho aquí y no con el plugin de capgo:
 *  - la distancia de cada carrera se pide sola (capgo la pedía junto con calorías y, sin ese permiso, llegaba vacía)
 *  - el estado completo para el diagnóstico de Ajustes (qué permisos hay, de qué apps llegan los datos)
 *  - los pasos de hoy para el aviso de las 5 pm, aunque la app esté cerrada (permiso "en segundo plano")
 */
object SaludNativa {

    private val alcance = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val LECTURA: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )
    private val FONDO: String = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
    private val CORRER = setOf(ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL)
    private val DESPIERTO = setOf(
        SleepSessionRecord.STAGE_TYPE_AWAKE,
        SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
        SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
    )
    private val WIDGETS = mapOf(
        "proteina" to ProteinaWidget::class.java,
        "hoy" to HoyWidget::class.java,
        "carrera" to CarreraWidget::class.java,
        "semana" to SemanaWidget::class.java,
    )

    private fun cliente(c: Context): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(c) == HealthConnectClient.SDK_AVAILABLE) HealthConnectClient.getOrCreate(c) else null

    private fun fondoDisponible(cl: HealthConnectClient): Boolean = try {
        cl.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    } catch (e: Exception) {
        false
    }

    /** Pantalla de permisos de Health Connect: los 4 de lectura y, si se pide, leer en segundo plano. */
    @JvmStatic
    fun intentPermisos(c: Context, fondo: Boolean): Intent? {
        val cl = cliente(c) ?: return null
        val pedir = if (fondo && fondoDisponible(cl)) LECTURA + FONDO else LECTURA
        return PermissionController.createRequestPermissionResultContract().createIntent(c, pedir)
    }

    @JvmStatic
    fun estado(c: Context, r: Respuesta) {
        alcance.launch { r.listo(seguro { estadoAhora(c) }) }
    }

    @JvmStatic
    fun leer(c: Context, dias: Int, r: Respuesta) {
        alcance.launch { r.listo(seguro { leerAhora(c, dias.coerceIn(1, 30)) }) }
    }

    private suspend fun seguro(f: suspend () -> JSONObject): JSONObject = try {
        f()
    } catch (e: Throwable) {
        JSONObject().put("ok", false).put("error", e.javaClass.simpleName + ": " + (e.message ?: ""))
    }

    private fun corto(p: String) = p.substringAfterLast('.')

    private suspend fun estadoAhora(c: Context): JSONObject {
        val o = JSONObject().put("ok", true)
        val sdk = HealthConnectClient.getSdkStatus(c)
        o.put("sdk", when (sdk) {
            HealthConnectClient.SDK_AVAILABLE -> "disponible"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "actualizar"
            else -> "no"
        })
        try {
            val pi = c.packageManager.getPackageInfo(c.packageName, 0)
            o.put("apk", pi.versionName ?: "")
        } catch (e: Exception) {
            o.put("apk", "")
        }
        val cl = cliente(c)
        if (cl != null) {
            val dados = cl.permissionController.getGrantedPermissions()
            o.put("permisos", JSONArray(LECTURA.filter { it in dados }.map { corto(it) }))
            o.put("faltan", JSONArray(LECTURA.filter { it !in dados }.map { corto(it) }))
            o.put("fondoDisponible", fondoDisponible(cl))
            o.put("fondo", FONDO in dados)
        }
        val am = AppWidgetManager.getInstance(c)
        val w = JSONObject()
        WIDGETS.forEach { (k, cls) -> w.put(k, am.getAppWidgetIds(ComponentName(c, cls))?.size ?: 0) }
        o.put("widgets", w)
        o.put("widgetsTs", Widgets.datos(c)?.optLong("ts", 0L) ?: 0L)
        o.put("cola", Widgets.cola(c).length())
        o.put("pasos", PasosAviso.config(c))
        return o
    }

    private suspend fun leerAhora(c: Context, dias: Int): JSONObject {
        val cl = cliente(c) ?: return JSONObject().put("ok", false).put("error", "Health Connect no está disponible")
        val dados = cl.permissionController.getGrantedPermissions()
        val zona = ZoneId.systemDefault()
        val ini = LocalDate.now().minusDays(dias.toLong()).atStartOfDay()
        val ahora = LocalDateTime.now()
        val o = JSONObject().put("ok", true).put("ts", System.currentTimeMillis())
        val errores = JSONArray()

        // Pasos por día (Health Connect ya quita duplicados entre el celular y el reloj)
        val pasos = JSONArray()
        val fPasos = linkedSetOf<String>()
        if (HealthPermission.getReadPermission(StepsRecord::class) in dados) {
            try {
                val grupos = cl.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(ini, ahora),
                        timeRangeSlicer = Period.ofDays(1),
                    )
                )
                grupos.forEach { g ->
                    val v = g.result[StepsRecord.COUNT_TOTAL] ?: 0L
                    g.result.dataOrigins.forEach { fPasos.add(it.packageName) }
                    if (v > 0) pasos.put(JSONObject().put("k", g.startTime.toLocalDate().toString()).put("v", v))
                }
            } catch (e: Exception) {
                errores.put("pasos: " + (e.message ?: e.javaClass.simpleName))
            }
        }
        o.put("pasos", pasos).put("fuentesPasos", JSONArray(fPasos.toList()))

        // Sueño: lo dormido (sin despierto ni fuera de la cama), en el día en que despertaste; una sola app por noche
        val sueno = JSONArray()
        val fSueno = linkedSetOf<String>()
        if (HealthPermission.getReadPermission(SleepSessionRecord::class) in dados) {
            try {
                val desde = ini.minusHours(12).atZone(zona).toInstant()
                val noches = mutableMapOf<String, MutableMap<String, Double>>()
                cl.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(desde, Instant.now()), pageSize = 200))
                    .records.forEach { s ->
                        val min = if (s.stages.isEmpty()) Duration.between(s.startTime, s.endTime).toMinutes().toDouble()
                        else s.stages.filter { it.stage !in DESPIERTO }.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }.toDouble()
                        if (min <= 0) return@forEach
                        val k = s.endTime.atZone(zona).toLocalDate().toString()
                        val app = s.metadata.dataOrigin.packageName
                        fSueno.add(app)
                        val porApp = noches.getOrPut(k) { mutableMapOf() }
                        porApp[app] = (porApp[app] ?: 0.0) + min
                    }
                noches.toSortedMap().forEach { (k, porApp) ->
                    val h = (porApp.values.maxOrNull() ?: 0.0) / 60.0
                    sueno.put(JSONObject().put("k", k).put("h", Math.round(h * 10) / 10.0))
                }
            } catch (e: Exception) {
                errores.put("sueño: " + (e.message ?: e.javaClass.simpleName))
            }
        }
        o.put("sueno", sueno).put("fuentesSueno", JSONArray(fSueno.toList()))

        // Ejercicio: las carreras con su distancia (se pide aparte, solo distancia)
        val runs = JSONArray()
        val fEj = linkedSetOf<String>()
        var sesiones = 0
        var sinDistancia = 0
        if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) in dados) {
            try {
                val desde = ini.atZone(zona).toInstant()
                cl.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.between(desde, Instant.now()), pageSize = 200))
                    .records.forEach { s ->
                        sesiones++
                        fEj.add(s.metadata.dataOrigin.packageName)
                        if (s.exerciseType !in CORRER) return@forEach
                        var metros = 0.0
                        if (HealthPermission.getReadPermission(DistanceRecord::class) in dados) {
                            try {
                                val a = cl.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), TimeRangeFilter.between(s.startTime, s.endTime)))
                                metros = a[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0
                            } catch (e: Exception) {
                                errores.put("distancia: " + (e.message ?: e.javaClass.simpleName))
                            }
                        }
                        if (metros < 500) {
                            sinDistancia++
                            return@forEach
                        }
                        val seg = Duration.between(s.startTime, s.endTime).seconds
                        runs.put(
                            JSONObject()
                                .put("uid", "hc-" + s.metadata.id)
                                .put("ts", s.startTime.toString())
                                .put("k", s.startTime.atZone(zona).toLocalDate().toString())
                                .put("km", Math.round(metros / 10.0) / 100.0)
                                .put("min", Math.round(seg / 6.0) / 10.0)
                                .put("fuente", s.metadata.dataOrigin.packageName)
                        )
                    }
            } catch (e: Exception) {
                errores.put("ejercicio: " + (e.message ?: e.javaClass.simpleName))
            }
        }
        o.put("runs", runs).put("sesiones", sesiones).put("sinDistancia", sinDistancia).put("fuentesEjercicio", JSONArray(fEj.toList()))
        o.put("errores", errores)
        return o
    }

    /** Pasos de hoy desde la medianoche; null si no hay permiso o ninguna app ha registrado pasos. */
    suspend fun pasosHoy(c: Context): Long? {
        val cl = cliente(c) ?: return null
        val r = cl.aggregate(
            AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(LocalDate.now().atStartOfDay(), LocalDateTime.now()))
        )
        if (r.dataOrigins.isEmpty()) return null
        return r[StepsRecord.COUNT_TOTAL] ?: 0L
    }
}
