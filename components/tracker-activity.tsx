"use client";
import { Footprints, Plus, Pencil } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";
import {
  type State,
  put,
  decimal,
  num,
  goalAt,
  stepStats,
  weekDates,
  monthDates,
  dateLabel,
  inputNumber,
} from "@/lib/tracker-core";
import {
  Btn,
  DatePicker,
  Field,
  Form,
  Progress,
  val,
  optional,
  type Save,
} from "./tracker-shared";
export function ActivityForm({
  state,
  date,
  save,
  close,
}: {
  state: State;
  date: string;
  save: Save;
  close: () => void;
}) {
  useI18n();
  const current = state.activity.find((x) => x.date === date);
  return (
    <Form
      cancel={close}
      onSubmit={async (d) => {
        const steps = optional(d, "steps", decimal);
        if (steps !== null && (!Number.isInteger(steps) || steps > 500000))
          throw Error(t("Skritt må være et heltall mellom 0 og 500 000."));
        const entry = {
          date: val(d, "date"),
          steps,
          burned: optional(d, "burned", decimal),
          note: val(d, "note"),
        };
        if (
          await save(
            (s) => put(s.activity, entry, "date"),
            t("Dagen er oppdatert"),
          )
        )
          close();
      }}
    >
      <Field label={t("Dato")}>
        <input name="date" type="date" required defaultValue={date} />
      </Field>
      <Field
        label={t("Totalt antall skritt")}
        hint={t(
          "Et nytt tall erstatter dagens tidligere total. Tomt betyr ikke registrert; 0 betyr null skritt.",
        )}
      >
        <input
          name="steps"
          inputMode="numeric"
          autoFocus
          defaultValue={current?.steps ?? ""}
          placeholder={t("Ikke registrert")}
        />
      </Field>
      <Field
        label={t("Kalorier forbrent (valgfritt)")}
        hint={t(
          "Vises separat. Trekkes ikke fra maten eller legges til målet.",
        )}
      >
        <input
          name="burned"
          inputMode="decimal"
          defaultValue={inputNumber(current?.burned)}
        />
      </Field>
      <Field label={t("Dagens notat (valgfritt)")}>
        <textarea
          name="note"
          maxLength={1000}
          rows={3}
          defaultValue={current?.note}
        />
      </Field>
    </Form>
  );
}
export function ActivityPage({
  state,
  date,
  setDate,
  edit,
  goals,
}: {
  state: State;
  date: string;
  setDate: (s: string) => void;
  edit: () => void;
  goals: () => void;
}) {
  useI18n();
  const day = state.activity.find((x) => x.date === date);
  const goal = goalAt(state, date);
  const week = weekDates(date);
  const weekly = stepStats(state, week),
    monthly = stepStats(state, monthDates(date.slice(0, 7)));
  const max = Math.max(
    goal?.steps ?? 0,
    ...week.map((d) => state.activity.find((x) => x.date === d)?.steps ?? 0),
    1,
  );
  return (
    <>
      <div className="page-toolbar">
        <DatePicker value={date} onChange={setDate} />
        <Btn onClick={edit}>
          <Plus size={17} />
          {t("Oppdater dagen")}
        </Btn>
      </div>
      <div className="activity-layout">
        <section className="panel activity-today">
          <div className="section-head">
            <h2>{t("Skritt den valgte dagen")}</h2>
            <Footprints size={22} />
          </div>
          <div className="step-count">
            {day?.steps == null ? "—" : num(day.steps)}{" "}
            <span>{t("skritt")}</span>
          </div>
          {goal?.steps ? (
            <>
              <Progress
                value={((day?.steps ?? 0) / goal.steps) * 100}
                label={t("Dagens skrittmål")}
              />
              <p className="help">
                {day?.steps != null
                  ? t("Dagens mål: {steps} skritt · {percent} % registrert", {
                      steps: num(goal.steps),
                      percent: num(Math.round((day.steps / goal.steps) * 100)),
                    })
                  : t("Dagens mål: {steps} skritt", { steps: num(goal.steps) })}
              </p>
            </>
          ) : (
            <button className="text-button" onClick={goals}>
              {t("Sett ditt eget skrittmål")} <Pencil size={14} />
            </button>
          )}
          <p className="help">
            {t(
              "Skritt føres manuelt. Appen er ikke koblet til telefon eller klokke.",
            )}
          </p>
          {day?.burned != null && (
            <p className="burned">
              {t("{calories} kcal forbrent · manuelt registrert", {
                calories: num(day.burned),
              })}
            </p>
          )}
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>{t("Uken din")}</h2>
            <span className="subtle">{t("Mandag–søndag")}</span>
          </div>
          <div
            className="step-chart"
            aria-label={t("Skritt per dag denne uken")}
          >
            {week.map((d) => {
              const value = state.activity.find((x) => x.date === d)?.steps;
              return (
                <button
                  key={d}
                  className={`day-bar ${d === date ? "selected" : ""}`}
                  onClick={() => setDate(d)}
                  aria-label={
                    value == null
                      ? t("{date}: ikke registrert", { date: dateLabel(d) })
                      : t("{date}: {steps} skritt", {
                          date: dateLabel(d),
                          steps: num(value),
                        })
                  }
                >
                  <span className="bar-value">
                    {value == null ? "—" : num(value)}
                  </span>
                  <span className="bar-column">
                    <span
                      style={{
                        height: `${value == null ? 0 : Math.max(2, (value / max) * 100)}%`,
                      }}
                    />
                    {value == null && <i />}
                  </span>
                  <span>
                    {dateLabel(d, { weekday: "short" }).replace(".", "")}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="help">
            {t(
              "Stiplet markør betyr manglende registrering. Null er en egen verdi.",
            )}
          </p>
        </section>
      </div>
      <div className="stats-line">
        <div>
          <span>{t("Uken · totalt")}</span>
          <strong>{t("{steps} skritt", { steps: num(weekly.total) })}</strong>
          <small>
            {weekly.count === 1
              ? t("1 registrert dag")
              : t("{count} registrerte dager", { count: num(weekly.count) })}
          </small>
        </div>
        <div>
          <span>{t("Uken · snitt per registrert dag")}</span>
          <strong>{weekly.average === null ? "—" : num(weekly.average)}</strong>
        </div>
        <div>
          <span>{t("Måneden · totalt")}</span>
          <strong>{t("{steps} skritt", { steps: num(monthly.total) })}</strong>
          <small>
            {monthly.count === 1
              ? t("1 registrert dag")
              : t("{count} registrerte dager", { count: num(monthly.count) })}
          </small>
        </div>
        <div>
          <span>{t("Måneden · snitt per registrert dag")}</span>
          <strong>
            {monthly.average === null ? "—" : num(monthly.average)}
          </strong>
        </div>
      </div>
      <section className="panel note-panel">
        <div className="section-head">
          <h2>{t("Dagens notat")}</h2>
          <button className="text-button" onClick={edit}>
            {t("Rediger")} <Pencil size={14} />
          </button>
        </div>
        <p>
          {day?.note ||
            t("Plass til en liten tanke fra dagen. Helt valgfritt.")}
        </p>
      </section>
    </>
  );
}
