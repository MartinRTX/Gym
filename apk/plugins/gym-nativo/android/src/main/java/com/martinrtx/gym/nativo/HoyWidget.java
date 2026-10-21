package com.martinrtx.gym.nativo;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Hoy toca: grupo, hora y la ruta corta del día. Al tocarlo abre la sesión. */
public class HoyWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject d = Widgets.datos(c);
        for (int id : ids) m.updateAppWidget(id, vista(c, d));
    }

    static RemoteViews vista(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.w_hoy);
        JSONObject h = d == null ? null : d.optJSONObject("hoy");
        boolean deHoy = h != null && Widgets.hoy().equals(h.optString("dia"));
        if (!deHoy) {
            v.setTextViewText(R.id.w_etiqueta, "HOY TOCA");
            v.setTextViewText(R.id.w_grupo, h == null ? "Entrenar" : h.optString("proximo", "Entrenar"));
            v.setTextViewText(R.id.w_ruta, "Toca para ver tu sesión");
        } else if (!h.optBoolean("entrena", true)) {
            v.setTextViewText(R.id.w_etiqueta, "HOY DESCANSAS");
            v.setTextViewText(R.id.w_grupo, "Próximo: " + h.optString("proximo", h.optString("grupo")));
            v.setTextViewText(R.id.w_ruta, h.optString("ruta", ""));
        } else {
            String hora = h.optString("hora", "");
            v.setTextViewText(R.id.w_etiqueta, "HOY TOCA" + (hora.isEmpty() ? "" : " · " + hora));
            v.setTextViewText(R.id.w_grupo, h.optString("grupo", "Entrenar"));
            v.setTextViewText(R.id.w_ruta, h.optString("ruta", ""));
        }
        v.setViewVisibility(R.id.w_ruta, View.VISIBLE);
        v.setOnClickPendingIntent(R.id.w_raiz, Widgets.abrir(c, "entrenar", 201));
        Widgets.aviso(v, d);
        return v;
    }
}
