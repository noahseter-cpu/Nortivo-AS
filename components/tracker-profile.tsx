"use client";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ShieldCheck, ArrowRight, UserRound } from "lucide-react";
import {
  type State,
  decimal,
  today,
  num,
  id,
  put,
  goalAt,
} from "@/lib/tracker-core";
import {
  profileSchema,
  calorieSuggestion,
  activityLevels,
  type Profile,
} from "@/lib/profile";
import { Btn, Field, Form, val, type Save } from "./tracker-shared";

export function ProfileSetup({
  state,
  save,
  close,
  first = false,
}: {
  state: State;
  save: Save;
  close: () => void;
  first?: boolean;
}) {
  const [draft, setDraft] = useState<{ name: string; profile: Profile } | null>(
    null,
  );
  const [previous, setPrevious] = useState<{
    name: string;
    profile: Profile;
  } | null>(null);
  const [selectedActivity, setSelectedActivity] = useState(
    state.profile?.activity ?? "",
  );
  const [goalChoice, setGoalChoice] = useState<"keep" | "suggested" | "custom">(
    "keep",
  );
  const [customCalories, setCustomCalories] = useState(
    String(goalAt(state, today())?.calories ?? ""),
  );
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, [draft]);
  const p = draft?.profile ?? previous?.profile ?? state.profile;
  const result = draft ? calorieSuggestion(draft.profile) : null;
  async function skip() {
    if (
      await save((s) => {
        s.profilePromptSeen = true;
      }, "Du kan fylle ut profilen senere")
    )
      close();
  }
  return (
    <main className="profile-page">
      <header className="profile-header">
        <span className="profile-wordmark">
          Arc by Norvido<span>·</span>
        </span>
        <span>
          <ShieldCheck size={15} /> Bare på denne enheten
        </span>
      </header>
      <div className="profile-layout">
        <aside className="profile-intro">
          <UserRound size={30} />
          <h1 ref={title} tabIndex={-1}>
            {draft ? "Et utgangspunkt for deg." : "La oss gjøre den til din."}
          </h1>
          <p>
            {draft
              ? "Et overslag, ikke en fasit. Du bestemmer om det skal bli ditt daglige mål."
              : "Litt om deg gir en mer personlig hverdag og et anslag på energien kroppen trenger."}
          </p>
          <div className="profile-privacy">
            Ingen e-post eller passord. Opplysningene blir på enheten og følger
            med når du lager en sikkerhetskopi.
          </div>
          <p className="profile-step">
            {draft ? "2 av 2 · Ditt forslag" : "1 av 2 · Din profil"}
          </p>
        </aside>
        <section
          className="profile-content"
          aria-label={draft ? "Kaloriforslag" : "Personlig profil"}
        >
          {!draft ? (
            <Form
              label="Se forslag"
              onSubmit={async (d) => {
                const name = val(d, "name");
                if (!name || name.length > 60)
                  throw Error("Skriv navnet ditt (maks 60 tegn).");
                const profile = profileSchema.parse({
                  heightCm: decimal(val(d, "height")),
                  weightKg: decimal(val(d, "weight")),
                  age: decimal(val(d, "age")),
                  equation: val(d, "equation"),
                  activity: val(d, "activity"),
                  suitability: val(d, "suitability"),
                  updatedAt: today(),
                });
                setDraft({ name, profile });
                setPrevious({ name, profile });
                setGoalChoice("keep");
              }}
            >
              <h2>Hvem er du?</h2>
              <Field label="Navn">
                <input
                  name="name"
                  autoComplete="given-name"
                  required
                  maxLength={60}
                  defaultValue={
                    previous?.name ?? (state.profile ? state.settings.name : "")
                  }
                />
              </Field>
              <div className="form-row">
                <Field label="Høyde (cm)">
                  <input
                    name="height"
                    inputMode="decimal"
                    required
                    defaultValue={p?.heightCm ?? ""}
                  />
                </Field>
                <Field label="Vekt (kg)">
                  <input
                    name="weight"
                    inputMode="decimal"
                    required
                    defaultValue={p?.weightKg ?? ""}
                  />
                </Field>
              </div>
              <Field label="Alder (år)">
                <input
                  name="age"
                  inputMode="numeric"
                  required
                  defaultValue={p?.age ?? ""}
                />
              </Field>
              <Field label="Beregningsgrunnlag">
                <select
                  name="equation"
                  required
                  defaultValue={p?.equation ?? ""}
                >
                  <option value="" disabled>
                    Velg grunnlag
                  </option>
                  <option value="female">Kvinnelig formel</option>
                  <option value="male">Mannlig formel</option>
                  <option value="none">Vil ikke oppgi / passer ikke</option>
                </select>
              </Field>
              <p className="help">
                Formelen bruker en biologisk kjønnskoeffisient. Det er ikke et
                spørsmål om kjønnsidentitet. Velg «passer ikke» hvis du er
                usikker; da settes ikke noe automatisk mål.
              </p>
              <Field label="Vanlig aktivitetsnivå">
                <select
                  name="activity"
                  required
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  <option value="" disabled>
                    Velg en vanlig uke
                  </option>
                  {Object.entries(activityLevels).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedActivity && (
                <p className="help">
                  {
                    activityLevels[selectedActivity as Profile["activity"]]
                      .detail
                  }
                  . Velg en vanlig uke, ikke den mest aktive dagen.
                </p>
              )}
              <Field label="Er et generelt voksenestimat egnet?">
                <select
                  name="suitability"
                  required
                  defaultValue={p?.suitability ?? ""}
                >
                  <option value="" disabled>
                    Velg det som passer
                  </option>
                  <option value="general">
                    Ja, ingen spesielle ernæringsbehov
                  </option>
                  <option value="pregnant">Gravid eller ammer</option>
                  <option value="medical">
                    Medisinske behov eller spiseforstyrrelse
                  </option>
                  <option value="none">Usikker / ønsker ikke et estimat</option>
                </select>
              </Field>
              <p className="help">
                Forslaget gjelder å holde vekten stabil. Ingen slankemål eller
                treningskalorier legges til automatisk.
              </p>
            </Form>
          ) : (
            <Form
              label="Lagre profil"
              onSubmit={async () => {
                const chosenCalories =
                  goalChoice === "custom"
                    ? decimal(customCalories, false)
                    : goalChoice === "suggested" && result?.eligible
                      ? result.calories
                      : null;
                if (
                  await save((s) => {
                    s.settings.name = draft.name;
                    s.profile = draft.profile;
                    s.profilePromptSeen = true;
                    if (chosenCalories !== null) {
                      const current = goalAt(s, today());
                      const existing = s.goals.find((g) => g.date === today());
                      put(s.goals, {
                        id: existing?.id ?? id(),
                        date: today(),
                        steps: current?.steps ?? null,
                        calories: chosenCalories,
                      });
                    }
                  }, "Profilen er lagret")
                )
                  close();
              }}
            >
              <h2>{draft.name}, her er overslaget ditt</h2>
              <p className="profile-measurements">
                {num(draft.profile.heightCm)} cm · {num(draft.profile.weightKg)}{" "}
                kg · {draft.profile.age} år
              </p>
              {result?.eligible ? (
                <>
                  <div className="profile-estimate">
                    <span>Anslått vedlikeholdsbehov</span>
                    <strong>
                      {num(result.calories)} <small>kcal / dag</small>
                    </strong>
                    <p>
                      Omtrent {num(result.low)}–{num(result.high)} kcal. Dette
                      ±10 % intervallet illustrerer usikkerhet; behovet kan
                      ligge utenfor.
                    </p>
                  </div>
                </>
              ) : (
                <div className="profile-unavailable">
                  <h3>Profil uten automatisk mål</h3>
                  <p>{result?.reason}</p>
                </div>
              )}
              <fieldset className="calorie-choice">
                <legend>Ditt daglige kalorimål</legend>
                <label className="check-label">
                  <input
                    type="radio"
                    name="goalChoice"
                    checked={goalChoice === "keep"}
                    onChange={() => setGoalChoice("keep")}
                  />
                  Behold nåværende mål / ikke sett et mål
                </label>
                {result?.eligible && (
                  <label className="check-label">
                    <input
                      type="radio"
                      name="goalChoice"
                      checked={goalChoice === "suggested"}
                      onChange={() => setGoalChoice("suggested")}
                    />
                    Bruk forslaget: {num(result.calories)} kcal per dag
                  </label>
                )}
                <label className="check-label">
                  <input
                    type="radio"
                    name="goalChoice"
                    checked={goalChoice === "custom"}
                    onChange={() => setGoalChoice("custom")}
                  />
                  Velg kalorimål selv
                </label>
                {goalChoice === "custom" && (
                  <Field label="Mitt kalorimål (kcal per dag)">
                    <input
                      inputMode="decimal"
                      required
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                    />
                  </Field>
                )}
                <p className="help">
                  Et eget mål er tallet du velger, ikke et beregnet behov.
                  Endringen gjelder fra i dag. Tidligere dagers mål og
                  registreringer beholdes.
                </p>
              </fieldset>
              <details className="profile-method">
                <summary>Slik beregnes forslaget</summary>
                <p>
                  Mifflin–St Jeor estimerer hvilebehov fra vekt, høyde, alder og
                  valgt koeffisient. Vi ganger med aktivitetsfaktoren{" "}
                  {activityLevels[draft.profile.activity].factor} og runder til
                  nærmeste 50 kcal. Aktivitetsfaktorene er grove anslag. Dette
                  er ikke NIDDKs dynamiske modell eller en medisinsk vurdering.
                </p>
                <p>
                  Brukes her bare for voksne 18–78 år uten spesielle
                  ernæringsbehov. Ved sykdom, graviditet, amming eller
                  spiseforstyrrelse: bruk individuell veiledning fra
                  helsepersonell.
                </p>
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Mifflin–St Jeor-studien
                </a>{" "}
                ·{" "}
                <a
                  href="https://www.niddk.nih.gov/bwp"
                  target="_blank"
                  rel="noreferrer"
                >
                  NIDDK om aktivitet og begrensninger
                </a>
              </details>
              <Btn secondary type="button" onClick={() => setDraft(null)}>
                <ArrowLeft size={16} /> Endre opplysninger
              </Btn>
            </Form>
          )}
          <button
            className="text-button profile-skip"
            onClick={() => (first ? void skip() : close())}
          >
            {first ? "Gjør dette senere" : "Tilbake til trackeren"}
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
    </main>
  );
}
