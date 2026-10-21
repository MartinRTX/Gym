package com.martinrtx.gym.nativo;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.json.JSONObject;

/** Carrera: días que faltan (se calculan aquí, siguen al día aunque no abras la app) y el trote de hoy. */
public class CarreraWidget extends AppWidgetProvider {

    private static final String[] MESES = { "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic" };

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject d = Widgets.datos(c);
        for (int id : ids) m.updateAppWidget(id, vista(c, d));
    }

    static RemoteViews vista(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.w_carrera);
        JSONObject k = d == null ? null : d.optJSONObject("carrera");
        LocalDate fecha = null;
        try {
            if (k != null) fecha = LocalDate.parse(k.optString("fecha"));
        } catch (Exception e) {
            fecha = null;
        }
        if (fecha == null) {
            v.setTextViewText(R.id.w_etiqueta, "CARRERA");
            v.setTextViewText(R.id.w_dias, "—");
            v.setTextViewText(R.id.w_dias_txt, "sin carrera");
            v.setTextViewText(R.id.w_trote, "Ponla en Ajustes");
        } else {
            long dias = ChronoUnit.DAYS.between(LocalDate.now(), fecha);
            v.setTextViewText(R.id.w_etiqueta, k.optString("nombre", "Carrera").toUpperCase() + " · " + fecha.getDayOfMonth() + " " + MESES[fecha.getMonthValue() - 1]);
            v.setTextViewText(R.id.w_dias, dias > 0 ? String.valueOf(dias) : dias == 0 ? "¡Hoy!" : "🏅");
            v.setTextViewText(R.id.w_dias_txt, dias > 1 ? "días" : dias == 1 ? "día" : dias == 0 ? "es la carrera" : "terminada");
            String trote = Widgets.hoy().equals(k.optString("dia")) ? k.optString("hoy", "") : "";
            v.setTextViewText(R.id.w_trote, trote.isEmpty() ? (dias >= 0 ? "Toca para ver tu plan" : "") : trote);
        }
        v.setOnClickPendingIntent(R.id.w_raiz, Widgets.abrir(c, "trote", 301));
        Widgets.aviso(v, d);
        return v;
    }
}
