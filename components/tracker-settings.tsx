"use client";
import { useId, useRef, useState } from "react";
import { t, useI18n } from "@/lib/i18n";
import {
  Download,
  Upload,
  ShieldCheck,
  Plus,
  Pencil,
  Archive,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  type State,
  id,
  goalAt,
  today,
  put,
  decimal,
  amountOre,
  validateState,
  mergeStates,
  csvTransactions,
  emptyState,
  dateLabel,
  num,
  inputNumber,
  categoryLabel,
} from "@/lib/tracker-core";
import {
  Btn,
  Field,
  Form,
  Modal,
  val,
  optional,
  download,
  type Save,
} from "./tracker-shared";

export function LanguagePicker() {
  const { language, setLanguage } = useI18n();
  const controlId = useId();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="language-control">
      <label htmlFor={controlId}>Språk / Language</label>
      <select
        id={controlId}
        value={language}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={failed ? `${controlId}-error` : undefined}
        onChange={async (event) => {
          const next = event.target.value;
          if (next !== "nb" && next !== "en") return;
          setPending(true);
          setFailed(false);
          try {
            await setLanguage(next);
          } catch {
            setFailed(true);
          } finally {
            setPending(false);
          }
        }}
      >
        <option value="nb" lang="nb">
          Norsk (bokmål)
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
      {failed && (
        <p id={`${controlId}-error`} className="error-box" role="alert">
          {t("Språket kunne ikke lagres. Prøv igjen.")}
        </p>
      )}
    </div>
  );
}
export function GoalsForm({
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
  const goal = goalAt(state, date);
  return (
    <Form
      cancel={close}
      onSubmit={async (d) => {
        const date = val(d, "date"),
          steps = optional(d, "steps", decimal),
          calories = optional(d, "calories", decimal);
        if (
          steps !== null &&
          (!Number.isInteger(steps) || steps < 1 || steps > 500000)
        )
          throw Error(t("Skrittmålet må være et positivt heltall."));
        if (calories !== null && calories <= 0)
          throw Error(t("Kalorimålet må være positivt eller stå tomt."));
        if (
          await save((s) => {
            const existing = s.goals.find((x) => x.date === date);
            put(s.goals, { id: existing?.id ?? id(), date, steps, calories });
          }, t("Målene er oppdatert"))
        )
          close();
      }}
    >
      <Field label={t("Gjelder fra dato")}>
        <input type="date" name="date" required defaultValue={date} />
      </Field>
      <Field label={t("Skritt per dag (valgfritt)")}>
        <input
          name="steps"
          inputMode="numeric"
          placeholder={t("Ikke satt")}
          defaultValue={goal?.steps ?? ""}
        />
      </Field>
      <Field label={t("Kalorier per dag (valgfritt)")}>
        <input
          name="calories"
          inputMode="decimal"
          placeholder={t("Ikke satt")}
          defaultValue={inputNumber(goal?.calories)}
        />
      </Field>
      <p className="help">
        {t(
          "Velg målene selv. Tomt felt fjerner målet fra valgt dato. Tidligere dager beholder målene som gjaldt da.",
        )}
      </p>
    </Form>
  );
}
export function SettingsPage({
  state,
  save,
  goals,
  profile,
}: {
  state: State;
  save: Save;
  goals: () => void;
  profile: () => void;
}) {
  useI18n();
  const [incoming, setIncoming] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [restoreMode, setRestoreMode] = useState("merge");
  const [category, setCategory] = useState<State["categories"][number] | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const goal = goalAt(state, today());
  async function importFile(file: File) {
    setError("");
    if (file.size > 20_000_000) {
      setError("Filen er for stor. Maksimal størrelse er 20 MB.");
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      if (raw.format !== "noah-tracker-backup" || raw.version !== 1)
        throw Error("Ukjent sikkerhetskopi eller versjon.");
      setIncoming(validateState(raw.data));
    } catch (e) {
      setError(
        e instanceof Error &&
          e.message === "Ukjent sikkerhetskopi eller versjon."
          ? e.message
          : "Ugyldig sikkerhetskopi. Dine eksisterende data er uendret.",
      );
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel appearance-panel language-panel">
        <h2>{t("Språk og utseende")}</h2>
        <LanguagePicker />
        <p className="help">
          {t(
            "Språkvalget huskes på denne enheten. Valuta, matmarked og måleenheter endres ikke.",
          )}
        </p>
        <div className="settings-divider">
          <h3>{t("Utseende")}</h3>
          <p className="help">
            {t(
              "Velg lyst eller mørkt tema, eller følg telefonens innstilling.",
            )}
          </p>
          <div
            className="theme-options"
            role="group"
            aria-label={t("Fargetema")}
          >
            {(
              [
                ["light", "Lyst"],
                ["dark", "Mørkt"],
                ["system", "System"],
              ] as const
            ).map(([value, label]) => (
              <Btn
                key={value}
                secondary={state.settings.theme !== value}
                aria-pressed={state.settings.theme === value}
                onClick={() =>
                  save((s) => {
                    s.settings.theme = value;
                  }, t("Temaet er lagret"))
                }
              >
                {t(label)}
              </Btn>
            ))}
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>{t("Din profil")}</h2>
        <div className="personal-goal-section">
          <p className="help">
            {goal?.calories
              ? t(
                  "Kalorimål: {calories} kcal per dag. Du bestemmer målet selv.",
                  { calories: num(goal.calories) },
                )
              : t("Kalorimål: Ikke satt. Du bestemmer målet selv.")}
          </p>
          <Btn onClick={goals}>{t("Velg mitt kalorimål")}</Btn>
        </div>
        <div className="personal-profile-section">
          <p className="help">
            {state.profile
              ? t("{name} · {height} cm · {weight} kg · {age} år", {
                  name: state.settings.name,
                  height: num(state.profile.heightCm),
                  weight: num(state.profile.weightKg),
                  age: num(state.profile.age),
                })
              : t(
                  "Navn, kroppsmål og et valgfritt kaloriforslag – lagret på denne enheten.",
                )}
          </p>
          <Btn secondary onClick={profile}>
            {state.profile
              ? t("Endre profil og kaloriforslag")
              : t("Opprett profil")}
          </Btn>
        </div>
      </section>
      <section className="panel">
        <h2>{t("Din hverdag")}</h2>
        <Form
          label={t("Lagre innstillinger")}
          onSubmit={async (d) => {
            const openingAmount = optional(d, "opening", (s) =>
              amountOre(s, true),
            );
            const opening =
              openingAmount === null
                ? null
                : { amount: openingAmount, date: val(d, "openingDate") };
            await save((s) => {
              s.settings = {
                ...s.settings,
                name: val(d, "name"),
                opening,
                warning: decimal(val(d, "warning")),
                danger: decimal(val(d, "danger")),
                setup: true,
              };
            });
          }}
        >
          <Field label={t("Navn")}>
            <input
              name="name"
              required
              maxLength={60}
              defaultValue={state.settings.name}
            />
          </Field>
          <div className="form-row">
            <Field label={t("Åpningssaldo (kr, valgfritt)")}>
              <input
                name="opening"
                inputMode="decimal"
                defaultValue={
                  state.settings.opening
                    ? inputNumber(state.settings.opening.amount / 100)
                    : ""
                }
                placeholder={t("Ikke satt")}
              />
            </Field>
            <Field label={t("Ved starten av denne datoen")}>
              <input
                name="openingDate"
                type="date"
                defaultValue={state.settings.opening?.date ?? today()}
              />
            </Field>
          </div>
          <p className="help">
            {t(
              "Åpningssaldo er saldoen før dagens første registrering. Bare transaksjoner fra og med denne datoen endrer registrert saldo. Eldre registreringer er fortsatt med i sine månedsrapporter.",
            )}
          </p>
          <div className="form-row">
            <Field label={t("Tidlig budsjettvarsel (%)")}>
              <input
                name="warning"
                type="number"
                min={1}
                max={99}
                defaultValue={state.settings.warning}
                required
              />
            </Field>
            <Field label={t("Grensevarsel (%)")}>
              <input
                name="danger"
                type="number"
                min={100}
                max={200}
                defaultValue={state.settings.danger}
                required
              />
            </Field>
          </div>
        </Form>
        <div className="settings-divider">
          <div className="section-head">
            <h3>{t("Dine mål")}</h3>
            <button className="text-button" onClick={goals}>
              {t("Endre mål")} <Pencil size={14} />
            </button>
          </div>
          <p>
            {t("{steps} skritt · {calories} kcal", {
              steps: goal?.steps == null ? t("Ikke satt") : num(goal.steps),
              calories:
                goal?.calories == null ? t("Ikke satt") : num(goal.calories),
            })}
          </p>
          {state.goals.length > 0 && (
            <details>
              <summary>
                {t("Målhistorikk ({count})", {
                  count: num(state.goals.length),
                })}
              </summary>
              {[...state.goals]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((g) => (
                  <p className="help" key={g.id}>
                    {t("Fra {date}: {steps} skrittmål · {calories} kalorimål", {
                      date: dateLabel(g.date, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                      steps: g.steps == null ? t("Ingen") : num(g.steps),
                      calories:
                        g.calories == null ? t("Ingen") : num(g.calories),
                    })}
                  </p>
                ))}
            </details>
          )}
        </div>
      </section>
      <div className="settings-column">
        <section className="panel">
          <div className="section-head">
            <h2>{t("Dine data, på din enhet")}</h2>
            <ShieldCheck size={22} />
          </div>
          <p className="settings-copy">
            {t(
              "Registreringene og profilen lagres på denne enheten. Telefon og PC synkroniseres ikke. Avinstallering eller sletting av app- og nettleserdata kan fjerne registreringene. Lag en sikkerhetskopi først.",
            )}
          </p>
          <p className="help">
            {t(
              "Når du søker på nett, sendes søkeord eller strekkode og valgt matmarked til matkilden. Profil, notater og private matlogger deles ikke.",
            )}
          </p>
          <div className="backup-actions">
            <Btn
              secondary
              onClick={() =>
                download(
                  `arc-by-nortivo-${today()}.json`,
                  JSON.stringify(
                    {
                      format: "noah-tracker-backup",
                      version: 1,
                      exportedAt: new Date().toISOString(),
                      data: state,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              <Download size={17} />
              {t("Sikkerhetskopi")}
            </Btn>
            <Btn secondary onClick={() => upload.current?.click()}>
              <Upload size={17} />
              {t("Gjenopprett")}
            </Btn>
            <input
              ref={upload}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) importFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <button
            className="text-button"
            onClick={() =>
              download(
                `arc-by-nortivo-transactions-${today()}.csv`,
                csvTransactions(state),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={14} />
            {t("Eksporter transaksjoner som CSV")}
          </button>
          {error && (
            <div className="error-box" role="alert">
              {t(error)}
            </div>
          )}
          <p className="help">
            {t(
              "Sikkerhetskopier er ikke kryptert. Oppbevar filen et trygt sted. Lagrede matvarer kan brukes uten nett. I Android-appen fungerer også Matvaretabellen uten nett. Open Food Facts krever internett.",
            )}
          </p>
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>{t("Kategorier")}</h2>
            <button className="text-button" onClick={() => setAdding(true)}>
              <Plus size={16} />
              {t("Ny")}
            </button>
          </div>
          {state.categories.map((c) => (
            <div className="category-row" key={c.id}>
              <span className={c.archived ? "subtle" : ""}>
                {categoryLabel(c)}
                {c.archived ? t(" · arkivert") : ""}
              </span>
              <div className="actions">
                <button
                  className="icon-button quiet"
                  aria-label={t("Gi {name} nytt navn", {
                    name: categoryLabel(c),
                  })}
                  onClick={() => setCategory(c)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button quiet"
                  aria-label={
                    c.archived
                      ? t("Gjenåpne {name}", { name: categoryLabel(c) })
                      : t("Arkiver {name}", { name: categoryLabel(c) })
                  }
                  onClick={() =>
                    save((s) => {
                      const current = s.categories.find((x) => x.id === c.id)!;
                      if (
                        !current.archived &&
                        s.categories.filter((x) => !x.archived).length <= 1
                      )
                        throw Error(t("Behold minst én aktiv kategori."));
                      current.archived = !current.archived;
                    }, t("Kategorien er oppdatert"))
                  }
                >
                  {c.archived ? <RefreshCw size={14} /> : <Archive size={14} />}
                </button>
              </div>
            </div>
          ))}
          <p className="help">
            {t("Arkivering beholder historikk og tilknyttede transaksjoner.")}
          </p>
        </section>
        <button className="danger-link" onClick={() => setDeleting(true)}>
          <Trash2 size={15} />
          {t("Slett alle personlige data")}
        </button>
      </div>
      {(adding || category) && (
        <Modal
          title={category ? t("Gi kategorien nytt navn") : t("Ny kategori")}
          onClose={() => {
            setAdding(false);
            setCategory(null);
          }}
        >
          <Form
            onSubmit={async (d) => {
              if (
                await save((s) => {
                  const name = val(d, "name");
                  if (
                    s.categories.some(
                      (c) =>
                        c.id !== category?.id &&
                        c.name.toLocaleLowerCase("nb") ===
                          name.toLocaleLowerCase("nb"),
                    )
                  )
                    throw Error(t("Kategorinavnet finnes allerede."));
                  put(s.categories, {
                    id: category?.id ?? id(),
                    name,
                    archived: category?.archived ?? false,
                  });
                })
              ) {
                setAdding(false);
                setCategory(null);
              }
            }}
          >
            <Field label={t("Navn")}>
              <input
                name="name"
                required
                maxLength={70}
                autoFocus
                defaultValue={category?.name}
              />
            </Field>
          </Form>
        </Modal>
      )}
      {incoming && (
        <Modal
          title={t("Gjenopprett sikkerhetskopi")}
          onClose={() => setIncoming(null)}
        >
          <p className="help">
            {t(
              "Filen er validert. Transaksjoner: {transactions}. Matregistreringer: {logs}. Aktivitetsdager: {days}.",
              {
                transactions: num(incoming.transactions.length),
                logs: num(incoming.logs.length),
                days: num(incoming.activity.length),
              },
            )}
          </p>
          <Form
            label={t("Gjenopprett data")}
            cancel={() => setIncoming(null)}
            onSubmit={async () => {
              if (
                await save((s) => {
                  const next =
                    restoreMode === "merge"
                      ? mergeStates(s, incoming)
                      : incoming;
                  Object.assign(s, structuredClone(next));
                }, t("Sikkerhetskopien er gjenopprettet"))
              )
                setIncoming(null);
            }}
          >
            <Field label={t("Hvordan skal dataene brukes?")}>
              <select
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value)}
              >
                <option value="merge">
                  {t("Slå sammen · behold eksisterende ved konflikt")}
                </option>
                <option value="replace">
                  {t("Erstatt alle personlige data med filen")}
                </option>
              </select>
            </Field>
            <p className="notice">
              {restoreMode === "merge"
                ? t(
                    "ID-er, aktivitetsdatoer, månedsbudsjetter og mål-datoer som allerede finnes, beholdes. Innstillingene dine beholdes. Ingen duplikater legges til.",
                  )
                : t(
                    "Alle eksisterende personlige registreringer og innstillinger erstattes. Ta en sikkerhetskopi først.",
                  )}
            </p>
          </Form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title={t("Slette alle personlige data?")}
          onClose={() => setDeleting(false)}
        >
          <Form
            label={t("Slett alt")}
            cancel={() => setDeleting(false)}
            onSubmit={async (d) => {
              if (val(d, "confirm") !== t("SLETT"))
                throw Error(
                  t("Skriv {word} for å bekrefte.", { word: t("SLETT") }),
                );
              if (
                await save(
                  (s) => Object.assign(s, emptyState()),
                  t("Alle personlige registreringer er slettet"),
                )
              )
                setDeleting(false);
            }}
          >
            <p className="notice">
              {t(
                "Dette sletter transaksjoner, mål, mat, måltider og aktivitet i denne nettleseren. Handlingen kan ikke angres uten en sikkerhetskopi.",
              )}
            </p>
            <Field
              label={t("Skriv {word} for å bekrefte", { word: t("SLETT") })}
            >
              <input name="confirm" autoComplete="off" required />
            </Field>
          </Form>
        </Modal>
      )}
    </div>
  );
}
