package com.martinrtx.gym.nativo;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Proteína de hoy: anillo X/120 g y 2 botones con tus comidas más frecuentes (suman aquí y se suben al abrir la app). */
public class ProteinaWidget extends AppWidgetProvider {

    static final String SUMAR = "com.martinrtx.gym.nativo.SUMAR_PROTEINA";
    private static final int[] BOTONES = { R.id.w_boton1, R.id.w_boton2 };
    private static long ultimoToque = 0;
    private static String ultimaComida = "";

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject d = Widgets.datos(c);
        for (int id : ids) m.updateAppWidget(id, vista(c, d));
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (SUMAR.equals(intent.getAction())) {
            String k = intent.getStringExtra("k");
            int g = intent.getIntExtra("g", 0);
            long ahora = System.currentTimeMillis();
            // Un doble toque por error no suma dos veces
            if (k != null && g > 0 && !(k.equals(ultimaComida) && ahora - ultimoToque < 1500)) {
                ultimaComida = k;
                ultimoToque = ahora;
                Widgets.agregarACola(c, k, g);
            }
            Widgets.actualizarTodos(c);
            return;
        }
        super.onReceive(c, intent);
    }

    static RemoteViews vista(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.w_proteina);
        String hoy = Widgets.hoy();
        JSONObject p = d == null ? null : d.optJSONObject("prot");
        int meta = p == null ? 120 : p.optInt("meta", 120);
        int g = (p != null && hoy.equals(p.optString("dia")) ? p.optInt("g", 0) : 0) + Widgets.gramosEnCola(c, hoy);
        v.setTextViewText(R.id.w_gramos, String.valueOf(g));
        v.setTextViewText(R.id.w_meta, g >= meta ? "¡meta! ✓" : "de " + meta + " g");
        v.setImageViewBitmap(R.id.w_anillo, Widgets.anillo(c, meta > 0 ? g / (float) meta : 0f));
        v.setOnClickPendingIntent(R.id.w_anillo_caja, Widgets.abrir(c, "comida", 101));

        JSONArray botones = p == null ? null : p.optJSONArray("botones");
        for (int i = 0; i < BOTONES.length; i++) {
            JSONObject b = botones == null ? null : botones.optJSONObject(i);
            if (b == null) {
                v.setViewVisibility(BOTONES[i], View.GONE);
                continue;
            }
            v.setViewVisibility(BOTONES[i], View.VISIBLE);
            v.setTextViewText(BOTONES[i], "+" + b.optInt("g") + " g " + b.optString("t"));
            Intent sumar = new Intent(c, ProteinaWidget.class).setAction(SUMAR);
            sumar.putExtra("k", b.optString("k"));
            sumar.putExtra("g", b.optInt("g"));
            v.setOnClickPendingIntent(BOTONES[i], PendingIntent.getBroadcast(c, 110 + i, sumar, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        Widgets.aviso(v, d);
        return v;
    }
}
