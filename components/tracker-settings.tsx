"use client";
import { useRef, useState } from "react";
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
  money,
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
          throw Error("Skrittmålet må være et positivt heltall.");
        if (calories !== null && calories <= 0)
          throw Error("Kalorimålet må være positivt eller stå tomt.");
        if (
          await save((s) => {
            const existing = s.goals.find((x) => x.date === date);
            put(s.goals, { id: existing?.id ?? id(), date, steps, calories });
          }, "Målene er oppdatert")
        )
          close();
      }}
    >
      <Field label="Gjelder fra dato">
        <input type="date" name="date" required defaultValue={date} />
      </Field>
      <Field label="Skritt per dag (valgfritt)">
        <input
          name="steps"
          inputMode="numeric"
          placeholder="Ikke satt"
          defaultValue={goal?.steps ?? ""}
        />
      </Field>
      <Field label="Kalorier per dag (valgfritt)">
        <input
          name="calories"
          inputMode="decimal"
          placeholder="Ikke satt"
          defaultValue={goal?.calories ?? ""}
        />
      </Field>
      <p className="help">
        Velg målene selv. Tomt felt fjerner målet fra valgt dato. Tidligere
        dager beholder målene som gjaldt da.
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
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Ugyldig sikkerhetskopi. Dine eksisterende data er uendret.",
      );
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel appearance-panel">
        <h2>Utseende</h2>
        <p className="help">
          Velg lyst eller mørkt tema, eller følg telefonens innstilling.
        </p>
        <div className="theme-options" role="group" aria-label="Fargetema">
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
                }, "Temaet er lagret")
              }
            >
              {label}
            </Btn>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Din profil</h2>
        <div className="personal-goal-section">
        <p className="help">
          Kalorimål:{" "}
          {goal?.calories ? goal.calories + " kcal per dag" : "Ikke satt"}. Du
          bestemmer målet selv.
        </p>
        <Btn onClick={goals}>Velg mitt kalorimål</Btn>
        </div>
        <div className="personal-profile-section">
        <p className="help">
          {state.profile
            ? `${state.settings.name} · ${state.profile.heightCm} cm · ${state.profile.weightKg} kg · ${state.profile.age} år`
            : "Navn, kroppsmål og et valgfritt kaloriforslag – lagret på denne enheten."}
        </p>
        <Btn secondary onClick={profile}>
          {state.profile ? "Endre profil og kaloriforslag" : "Opprett profil"}
        </Btn>
        </div>
      </section>
      <section className="panel">
        <h2>Din hverdag</h2>
        <Form
          label="Lagre innstillinger"
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
          <Field label="Navn">
            <input
              name="name"
              required
              maxLength={60}
              defaultValue={state.settings.name}
            />
          </Field>
          <div className="form-row">
            <Field label="Åpningssaldo (kr, valgfritt)">
              <input
                name="opening"
                inputMode="decimal"
                defaultValue={
                  state.settings.opening
                    ? state.settings.opening.amount / 100
                    : ""
                }
                placeholder="Ikke satt"
              />
            </Field>
            <Field label="Ved starten av denne datoen">
              <input
                name="openingDate"
                type="date"
                defaultValue={state.settings.opening?.date ?? today()}
              />
            </Field>
          </div>
          <p className="help">
            Åpningssaldo er saldoen før dagens første registrering. Bare
            transaksjoner fra og med denne datoen endrer registrert saldo. Eldre
            registreringer er fortsatt med i sine månedsrapporter.
          </p>
          <div className="form-row">
            <Field label="Tidlig budsjettvarsel (%)">
              <input
                name="warning"
                type="number"
                min={1}
                max={99}
                defaultValue={state.settings.warning}
                required
              />
            </Field>
            <Field label="Grensevarsel (%)">
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
            <h3>Dine mål</h3>
            <button className="text-button" onClick={goals}>
              Endre mål <Pencil size={14} />
            </button>
          </div>
          <p>
            {goal?.steps ?? "Ikke satt"} skritt ·{" "}
            {goal?.calories ?? "Ikke satt"} kcal
          </p>
          {state.goals.length > 0 && (
            <details>
              <summary>Målhistorikk ({state.goals.length})</summary>
              {[...state.goals]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((g) => (
                  <p className="help" key={g.id}>
                    Fra{" "}
                    {dateLabel(g.date, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    : {g.steps ?? "Ingen"} skrittmål · {g.calories ?? "Ingen"}{" "}
                    kalorimål
                  </p>
                ))}
            </details>
          )}
        </div>
      </section>
      <div className="settings-column">
        <section className="panel">
          <div className="section-head">
            <h2>Dine data, på din enhet</h2>
            <ShieldCheck size={22} />
          </div>
          <p className="settings-copy">
            Registreringene og profilen lagres på denne enheten. Telefon og PC
            synkroniseres ikke. Avinstallering eller sletting av app- og
            nettleserdata kan fjerne registreringene. Lag en sikkerhetskopi
            først.
          </p>
          <div className="backup-actions">
            <Btn
              secondary
              onClick={() =>
                download(
                  `arc-by-norvido-${today()}.json`,
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
              Sikkerhetskopi
            </Btn>
            <Btn secondary onClick={() => upload.current?.click()}>
              <Upload size={17} />
              Gjenopprett
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
                `arc-by-norvido-transaksjoner-${today()}.csv`,
                csvTransactions(state),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={14} />
            Eksporter transaksjoner som CSV
          </button>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <p className="help">
            Sikkerhetskopier er ikke kryptert. Oppbevar filen et trygt sted.
            Lagrede matvarer kan brukes uten nett. I Android-appen fungerer også
            Matvaretabellen uten nett. Open Food Facts krever internett.
          </p>
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>Kategorier</h2>
            <button className="text-button" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Ny
            </button>
          </div>
          {state.categories.map((c) => (
            <div className="category-row" key={c.id}>
              <span className={c.archived ? "subtle" : ""}>
                {c.name}
                {c.archived ? " · arkivert" : ""}
              </span>
              <div className="actions">
                <button
                  className="icon-button quiet"
                  aria-label={`Gi ${c.name} nytt navn`}
                  onClick={() => setCategory(c)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button quiet"
                  aria-label={`${c.archived ? "Gjenåpne" : "Arkiver"} ${c.name}`}
                  onClick={() =>
                    save((s) => {
                      const current = s.categories.find((x) => x.id === c.id)!;
                      if (
                        !current.archived &&
                        s.categories.filter((x) => !x.archived).length <= 1
                      )
                        throw Error("Behold minst én aktiv kategori.");
                      current.archived = !current.archived;
                    }, "Kategorien er oppdatert")
                  }
                >
                  {c.archived ? <RefreshCw size={14} /> : <Archive size={14} />}
                </button>
              </div>
            </div>
          ))}
          <p className="help">
            Arkivering beholder historikk og tilknyttede transaksjoner.
          </p>
        </section>
        <button className="danger-link" onClick={() => setDeleting(true)}>
          <Trash2 size={15} />
          Slett alle personlige data
        </button>
      </div>
      {(adding || category) && (
        <Modal
          title={category ? "Gi kategorien nytt navn" : "Ny kategori"}
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
                    throw Error("Kategorinavnet finnes allerede.");
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
            <Field label="Navn">
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
          title="Gjenopprett sikkerhetskopi"
          onClose={() => setIncoming(null)}
        >
          <p className="help">
            Filen er validert: {incoming.transactions.length} transaksjoner,{" "}
            {incoming.logs.length} matregistreringer og{" "}
            {incoming.activity.length} aktivitetsdager.
          </p>
          <Form
            label="Gjenopprett data"
            cancel={() => setIncoming(null)}
            onSubmit={async () => {
              if (
                await save((s) => {
                  const next =
                    restoreMode === "merge"
                      ? mergeStates(s, incoming)
                      : incoming;
                  Object.assign(s, structuredClone(next));
                }, "Sikkerhetskopien er gjenopprettet")
              )
                setIncoming(null);
            }}
          >
            <Field label="Hvordan skal dataene brukes?">
              <select
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value)}
              >
                <option value="merge">
                  Slå sammen · behold eksisterende ved konflikt
                </option>
                <option value="replace">
                  Erstatt alle personlige data med filen
                </option>
              </select>
            </Field>
            <p className="notice">
              {restoreMode === "merge"
                ? "ID-er, aktivitetsdatoer, månedsbudsjetter og mål-datoer som allerede finnes, beholdes. Innstillingene dine beholdes. Ingen duplikater legges til."
                : "Alle eksisterende personlige registreringer og innstillinger erstattes. Ta en sikkerhetskopi først."}
            </p>
          </Form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Slette alle personlige data?"
          onClose={() => setDeleting(false)}
        >
          <Form
            label="Slett alt"
            cancel={() => setDeleting(false)}
            onSubmit={async (d) => {
              if (val(d, "confirm") !== "SLETT")
                throw Error("Skriv SLETT for å bekrefte.");
              if (
                await save(
                  (s) => Object.assign(s, emptyState()),
                  "Alle personlige registreringer er slettet",
                )
              )
                setDeleting(false);
            }}
          >
            <p className="notice">
              Dette sletter transaksjoner, mål, mat, måltider og aktivitet i
              denne nettleseren. Handlingen kan ikke angres uten en
              sikkerhetskopi.
            </p>
            <Field label="Skriv SLETT for å bekrefte">
              <input name="confirm" autoComplete="off" required />
            </Field>
          </Form>
        </Modal>
      )}
    </div>
  );
}
