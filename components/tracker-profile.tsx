"use client";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ShieldCheck, ArrowRight, UserRound } from "lucide-react";
import { t, useI18n } from "@/lib/i18n";
import {
  type State,
  decimal,
  today,
  num,
  id,
  put,
  goalAt,
  inputNumber,
} from "@/lib/tracker-core";
import {
  profileSchema,
  calorieSuggestion,
  activityLevels,
  type Profile,
} from "@/lib/profile";
import { Btn, Field, Form, val, type Save } from "./tracker-shared";
import { LanguagePicker } from "./tracker-settings";

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
  useI18n();
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
    inputNumber(goalAt(state, today())?.calories),
  );
  const [skipping, setSkipping] = useState(false);
  const skipLock = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, [draft]);
  const p = draft?.profile ?? previous?.profile ?? state.profile;
  const result = draft ? calorieSuggestion(draft.profile) : null;
  async function skip() {
    if (skipLock.current) return;
    skipLock.current = true;
    setSkipping(true);
    try {
      if (
        await save((s) => {
          s.profilePromptSeen = true;
        }, t("Du kan fylle ut profilen senere"))
      )
        close();
    } finally {
      skipLock.current = false;
      setSkipping(false);
    }
  }
  return (
    <main className="profile-page">
      <header className="profile-header">
        <span className="profile-wordmark">
          Arc by Nortivo<span>·</span>
        </span>
        <span className="profile-local">
          <ShieldCheck size={15} /> {t("Bare på denne enheten")}
        </span>
        <LanguagePicker />
      </header>
      <div className="profile-layout">
        <aside className="profile-intro">
          <UserRound size={30} />
          <h1 ref={title} tabIndex={-1}>
            {draft
              ? t("Et utgangspunkt for deg.")
              : t("La oss gjøre den til din.")}
          </h1>
          <p>
            {draft
              ? t(
                  "Et overslag, ikke en fasit. Du bestemmer om det skal bli ditt daglige mål.",
                )
              : t(
                  "Litt om deg gir en mer personlig hverdag og et anslag på energien kroppen trenger.",
                )}
          </p>
          <div className="profile-privacy">
            {t(
              "Ingen e-post eller passord. Opplysningene blir på enheten og følger med når du lager en sikkerhetskopi.",
            )}
          </div>
          <p className="profile-step">
            {draft ? t("2 av 2 · Ditt forslag") : t("1 av 2 · Din profil")}
          </p>
        </aside>
        <section
          className="profile-content"
          aria-label={draft ? t("Kaloriforslag") : t("Personlig profil")}
        >
          {!draft ? (
            <Form
              label={t("Se forslag")}
              onSubmit={async (d) => {
                const name = val(d, "name");
                if (!name || name.length > 60)
                  throw Error(t("Skriv navnet ditt (maks 60 tegn)."));
                const parsed = profileSchema.safeParse({
                  heightCm: decimal(val(d, "height")),
                  weightKg: decimal(val(d, "weight")),
                  age: decimal(val(d, "age")),
                  equation: val(d, "equation"),
                  activity: val(d, "activity"),
                  suitability: val(d, "suitability"),
                  updatedAt: today(),
                });
                if (!parsed.success) {
                  const errors: Record<string, string> = {
                    heightCm: "Høyden må være mellom 80 og 250 cm.",
                    weightKg: "Vekten må være mellom 20 og 400 kg.",
                    age: "Alderen må være et heltall mellom 1 og 120 år.",
                    equation: "Velg et beregningsgrunnlag.",
                    activity: "Velg ditt vanlige aktivitetsnivå.",
                    suitability:
                      "Velg om et generelt voksenestimat passer for deg.",
                  };
                  throw Error(
                    t(
                      errors[String(parsed.error.issues[0]?.path[0])] ??
                        "Kontroller profilopplysningene og prøv igjen.",
                    ),
                  );
                }
                const profile = parsed.data;
                setDraft({ name, profile });
                setPrevious({ name, profile });
                setGoalChoice("keep");
              }}
            >
              <h2>{t("Hvem er du?")}</h2>
              <Field label={t("Navn")}>
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
                <Field label={t("Høyde (cm)")}>
                  <input
                    name="height"
                    inputMode="decimal"
                    required
                    defaultValue={inputNumber(p?.heightCm)}
                  />
                </Field>
                <Field label={t("Vekt (kg)")}>
                  <input
                    name="weight"
                    inputMode="decimal"
                    required
                    defaultValue={inputNumber(p?.weightKg)}
                  />
                </Field>
              </div>
              <Field label={t("Alder (år)")}>
                <input
                  name="age"
                  inputMode="numeric"
                  required
                  defaultValue={p?.age ?? ""}
                />
              </Field>
              <Field label={t("Beregningsgrunnlag")}>
                <select
                  name="equation"
                  required
                  defaultValue={p?.equation ?? ""}
                >
                  <option value="" disabled>
                    {t("Velg grunnlag")}
                  </option>
                  <option value="female">{t("Kvinnelig formel")}</option>
                  <option value="male">{t("Mannlig formel")}</option>
                  <option value="none">
                    {t("Vil ikke oppgi / passer ikke")}
                  </option>
                </select>
              </Field>
              <p className="help">
                {t(
                  "Formelen bruker en biologisk kjønnskoeffisient. Det er ikke et spørsmål om kjønnsidentitet. Velg «passer ikke» hvis du er usikker; da settes ikke noe automatisk mål.",
                )}
              </p>
              <Field label={t("Vanlig aktivitetsnivå")}>
                <select
                  name="activity"
                  required
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  <option value="" disabled>
                    {t("Velg en vanlig uke")}
                  </option>
                  {Object.entries(activityLevels).map(([key, v]) => (
                    <option key={key} value={key}>
                      {t(v.label)}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedActivity && (
                <p className="help">
                  {t(
                    "{description}. Velg en vanlig uke, ikke den mest aktive dagen.",
                    {
                      description: t(
                        activityLevels[selectedActivity as Profile["activity"]]
                          .detail,
                      ),
                    },
                  )}
                </p>
              )}
              <Field label={t("Er et generelt voksenestimat egnet?")}>
                <select
                  name="suitability"
                  required
                  defaultValue={p?.suitability ?? ""}
                >
                  <option value="" disabled>
                    {t("Velg det som passer")}
                  </option>
                  <option value="general">
                    {t("Ja, ingen spesielle ernæringsbehov")}
                  </option>
                  <option value="pregnant">{t("Gravid eller ammer")}</option>
                  <option value="medical">
                    {t("Medisinske behov eller spiseforstyrrelse")}
                  </option>
                  <option value="none">
                    {t("Usikker / ønsker ikke et estimat")}
                  </option>
                </select>
              </Field>
              <p className="help">
                {t(
                  "Forslaget gjelder å holde vekten stabil. Ingen slankemål eller treningskalorier legges til automatisk.",
                )}
              </p>
            </Form>
          ) : (
            <Form
              label={t("Lagre profil")}
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
                  }, t("Profilen er lagret"))
                )
                  close();
              }}
            >
              <h2>
                {t("{name}, her er overslaget ditt", { name: draft.name })}
              </h2>
              <p className="profile-measurements">
                {t("{height} cm · {weight} kg · {age} år", {
                  height: num(draft.profile.heightCm),
                  weight: num(draft.profile.weightKg),
                  age: num(draft.profile.age),
                })}
              </p>
              {result?.eligible ? (
                <>
                  <div className="profile-estimate">
                    <span>{t("Anslått vedlikeholdsbehov")}</span>
                    <strong>
                      {num(result.calories)} <small>{t("kcal / dag")}</small>
                    </strong>
                    <p>
                      {t(
                        "Omtrent {low}–{high} kcal. Dette ±10 % intervallet illustrerer usikkerhet; behovet kan ligge utenfor.",
                        { low: num(result.low), high: num(result.high) },
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <div className="profile-unavailable">
                  <h3>{t("Profil uten automatisk mål")}</h3>
                  <p>{result?.reason ? t(result.reason) : ""}</p>
                </div>
              )}
              <fieldset className="calorie-choice">
                <legend>{t("Ditt daglige kalorimål")}</legend>
                <label className="check-label">
                  <input
                    type="radio"
                    name="goalChoice"
                    checked={goalChoice === "keep"}
                    onChange={() => setGoalChoice("keep")}
                  />
                  {t("Behold nåværende mål / ikke sett et mål")}
                </label>
                {result?.eligible && (
                  <label className="check-label">
                    <input
                      type="radio"
                      name="goalChoice"
                      checked={goalChoice === "suggested"}
                      onChange={() => setGoalChoice("suggested")}
                    />
                    {t("Bruk forslaget: {calories} kcal per dag", {
                      calories: num(result.calories),
                    })}
                  </label>
                )}
                <label className="check-label">
                  <input
                    type="radio"
                    name="goalChoice"
                    checked={goalChoice === "custom"}
                    onChange={() => setGoalChoice("custom")}
                  />
                  {t("Velg kalorimål selv")}
                </label>
                {goalChoice === "custom" && (
                  <Field label={t("Mitt kalorimål (kcal per dag)")}>
                    <input
                      inputMode="decimal"
                      required
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                    />
                  </Field>
                )}
                <p className="help">
                  {t(
                    "Et eget mål er tallet du velger, ikke et beregnet behov. Endringen gjelder fra i dag. Tidligere dagers mål og registreringer beholdes.",
                  )}
                </p>
              </fieldset>
              <details className="profile-method">
                <summary>{t("Slik beregnes forslaget")}</summary>
                <p>
                  {t(
                    "Mifflin–St Jeor estimerer hvilebehov fra vekt, høyde, alder og valgt koeffisient. Vi ganger med aktivitetsfaktoren {factor} og runder til nærmeste 50 kcal. Aktivitetsfaktorene er grove anslag. Dette er ikke NIDDKs dynamiske modell eller en medisinsk vurdering.",
                    {
                      factor: num(
                        activityLevels[draft.profile.activity].factor,
                      ),
                    },
                  )}
                </p>
                <p>
                  {t(
                    "Brukes her bare for voksne 18–78 år uten spesielle ernæringsbehov. Ved sykdom, graviditet, amming eller spiseforstyrrelse: bruk individuell veiledning fra helsepersonell.",
                  )}
                </p>
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Mifflin–St Jeor-studien")}
                </a>{" "}
                ·{" "}
                <a
                  href="https://www.niddk.nih.gov/bwp"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("NIDDK om aktivitet og begrensninger")}
                </a>
              </details>
              <Btn secondary type="button" onClick={() => setDraft(null)}>
                <ArrowLeft size={16} /> {t("Endre opplysninger")}
              </Btn>
            </Form>
          )}
          <button
            className="text-button profile-skip"
            disabled={skipping}
            aria-busy={skipping}
            onClick={() => (first ? void skip() : close())}
          >
            {first ? t("Gjør dette senere") : t("Tilbake til trackeren")}
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
    </main>
  );
}
