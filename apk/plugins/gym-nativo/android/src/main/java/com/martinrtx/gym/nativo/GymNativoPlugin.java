package com.martinrtx.gym.nativo;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Puente entre la app y lo nativo:
 *  - guardarWidgets: la app guarda lo que muestran los widgets y se repintan al momento.
 *  - tomarCola: comidas que agregaste desde el widget de proteína (la app las suma y las sube a la hoja).
 *  - consumirAccion: si la app se abrió desde un widget o un acceso directo (gymmb://accion/…), qué sección abrir.
 *  - Accesos directos del ícono (mantener presionado): Registrar peso, Añadir comida, Empezar entrenamiento.
 *  - Health Connect (solo lectura): permisos, lectura de pasos/sueño/carreras y el estado para el diagnóstico.
 *  - configurarPasos: el aviso de las 5 pm si vas atrasado en pasos.
 */
@CapacitorPlugin(name = "GymNativo")
public class GymNativoPlugin extends Plugin {

    private String pendiente = null;

    @Override
    public void load() {
        if (getActivity() != null) tomarDeIntent(getActivity().getIntent());
        ponerAccesos(getContext());
        PasosAviso.programar(getContext());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (tomarDeIntent(intent)) {
            JSObject ret = new JSObject();
            ret.put("url", pendiente);
            notifyListeners("accion", ret, true);
        }
    }

    private boolean tomarDeIntent(Intent intent) {
        if (intent == null) return false;
        Uri d = intent.getData();
        if (d == null || !Widgets.ESQUEMA.equals(d.getScheme())) return false;
        pendiente = d.toString();
        return true;
    }

    @PluginMethod
    public void consumirAccion(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendiente != null) ret.put("url", pendiente);
        pendiente = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void guardarWidgets(PluginCall call) {
        JSObject datos = call.getObject("datos");
        if (datos == null) {
            call.reject("Faltan los datos");
            return;
        }
        Widgets.guardarDatos(getContext(), datos.toString());
        Widgets.actualizarTodos(getContext());
        call.resolve();
    }

    @PluginMethod
    public void tomarCola(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            ret.put("items", new JSArray(Widgets.tomarCola(getContext()).toString()));
        } catch (JSONException e) {
            ret.put("items", new JSArray());
        }
        Widgets.actualizarTodos(getContext());
        call.resolve(ret);
    }

    /** Diagnóstico: versión del APK, Health Connect, widgets puestos y aviso de pasos. */
    @PluginMethod
    public void estado(PluginCall call) {
        SaludNativa.estado(getContext(), r -> responder(call, r));
    }

    /** Pasos por día, sueño por noche y carreras (con distancia) de los últimos días. */
    @PluginMethod
    public void leerSalud(PluginCall call) {
        SaludNativa.leer(getContext(), call.getInt("dias", 7), r -> responder(call, r));
    }

    /** Abre la pantalla de permisos de Health Connect (con "en segundo plano" si se pide). */
    @PluginMethod
    public void conectarSalud(PluginCall call) {
        Intent i = SaludNativa.intentPermisos(getContext(), Boolean.TRUE.equals(call.getBoolean("fondo", false)));
        if (i == null) {
            SaludNativa.estado(getContext(), r -> responder(call, r));
            return;
        }
        try {
            startActivityForResult(call, i, "permisosListos");
        } catch (Exception e) {
            call.reject("No se pudo abrir Health Connect");
        }
    }

    @ActivityCallback
    private void permisosListos(PluginCall call, ActivityResult result) {
        if (call == null) return;
        SaludNativa.estado(getContext(), r -> responder(call, r));
    }

    @PluginMethod
    public void configurarPasos(PluginCall call) {
        PasosAviso.configurar(
            getContext(),
            Boolean.TRUE.equals(call.getBoolean("activo", false)),
            call.getInt("meta", 7000),
            call.getInt("hora", 17),
            call.getInt("minuto", 0),
            Boolean.TRUE.equals(call.getBoolean("laborales", true))
        );
        SaludNativa.estado(getContext(), r -> responder(call, r));
    }

    private static void responder(PluginCall call, JSONObject r) {
        try {
            call.resolve(JSObject.fromJSONObject(r));
        } catch (JSONException e) {
            call.reject(e.getMessage());
        }
    }

    /** Accesos directos al mantener presionado el ícono (dinámicos: aparecen después de abrir la app una vez). */
    static void ponerAccesos(Context c) {
        ShortcutManager sm = c.getSystemService(ShortcutManager.class);
        if (sm == null) return;
        List<ShortcutInfo> lista = new ArrayList<>();
        lista.add(acceso(c, "peso", "Registrar peso", R.drawable.ic_sc_peso));
        lista.add(acceso(c, "comida", "Añadir comida", R.drawable.ic_sc_comida));
        lista.add(acceso(c, "entrenar", "Empezar entrenamiento", R.drawable.ic_sc_entrenar));
        try {
            sm.setDynamicShortcuts(lista);
        } catch (Exception e) {
            // Algunos launchers limitan los accesos directos; la app funciona igual sin ellos
        }
    }

    private static ShortcutInfo acceso(Context c, String id, String nombre, int icono) {
        return new ShortcutInfo.Builder(c, id)
            .setShortLabel(nombre)
            .setLongLabel(nombre)
            .setIcon(Icon.createWithResource(c, icono))
            .setIntent(Widgets.intentAccion(c, id))
            .build();
    }
}
