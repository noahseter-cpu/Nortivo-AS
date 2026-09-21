"use client";
import { useEffect, useRef, useState } from "react";
import {
  Star,
  Plus,
  Search,
  ScanLine,
  Utensils,
  Pencil,
  Trash2,
  Camera,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  type State,
  type Food,
  type FoodLog,
  type Meal,
  id,
  foodSchema,
  decimal,
  kcal,
  put,
  num,
  inputNumber,
  dailyCalories,
} from "@/lib/tracker-core";
import {
  preferredFood,
  localizedFoodName,
  foodMatches,
  nutrientAmount,
  type NutrientKey,
} from "@/lib/food-adapters";
import {
  searchFoods,
  type SearchIssue,
  type FoodSearchResult,
} from "@/lib/food-search";
import { t, useI18n, getLanguage } from "@/lib/i18n";
import {
  Btn,
  Empty,
  Field,
  Form,
  DatePicker,
  val,
  type Save,
} from "./tracker-shared";
const foodName = (food: Food) => localizedFoodName(food, getLanguage());
const nutrientLabels: [NutrientKey, string][] = [
  ["protein", "Protein"],
  ["carbohydrate", "Karbohydrat"],
  ["fat", "Fett"],
  ["fiber", "Fiber"],
  ["sugar", "Sukkerarter"],
  ["salt", "Salt"],
];
function ownNutrients(data: FormData) {
  return Object.fromEntries(
    nutrientLabels.map(([key]) => {
      const raw = val(data, `nutrient-${key}`);
      const value = raw ? decimal(raw) : null;
      if (value !== null && value > 100)
        throw Error("Et næringsstoff kan ikke overstige 100 g per 100.");
      return [key, value];
    }),
  );
}
function Nutrition({
  food,
  amount = 100,
  unit = food.unit,
}: {
  food: Food;
  amount?: number;
  unit?: Food["unit"];
}) {
  useI18n();
  return (
    <dl className="food-nutrients">
      {nutrientLabels.map(([key, label]) => {
        const value = nutrientAmount(food, key, amount, unit);
        return (
          <div key={key}>
            <dt>{t(label)}</dt>
            <dd>{value === null ? t("Ukjent") : `${num(value)} g`}</dd>
          </div>
        );
      })}
    </dl>
  );
}
export function FoodForm({
  food,
  entry,
  date,
  save,
  close,
  saveOnly = false,
}: {
  food: Food;
  entry?: FoodLog;
  date: string;
  save: Save;
  close: () => void;
  saveOnly?: boolean;
}) {
  useI18n();
  const [logNow, setLogNow] = useState(false);
  const onlySave = saveOnly && !logNow;
  const [energy, setEnergy] = useState(inputNumber(food.kcal100));
  const [unit, setUnit] = useState<"g" | "ml" | "">(
    food.unit === "g" || food.unit === "ml" ? food.unit : "",
  );
  const [amount, setAmount] = useState(inputNumber(entry?.amount));
  const [portion, setPortion] = useState(inputNumber(food.portion));
  const isCustom = food.source === "Egen registrering";
  let preview: number | null = null;
  let sourceNutrientsMatch = false;
  try {
    sourceNutrientsMatch =
      food.kcal100 === decimal(energy) &&
      (food.unit === null || food.unit === unit);
    if (unit && energy !== "" && amount !== "")
      preview = kcal(
        { ...food, kcal100: decimal(energy), unit },
        decimal(amount, false),
      );
  } catch {
    /* Incomplete form. */
  }
  return (
    <Form
      cancel={close}
      label={t(onlySave ? "Lagre produkt" : "Logg maten")}
      onSubmit={async (d) => {
        if (!unit)
          throw Error("Velg gram eller milliliter fra næringsdeklarasjonen.");
        const corrected =
          !isCustom &&
          (food.kcal100 !== decimal(energy) || food.unit !== unit) &&
          food.source !== "Lagret måltid";
        const f = foodSchema.parse({
          ...food,
          id: corrected ? `custom:${id()}` : food.id,
          name: val(d, "name") || food.name,
          kcal100: decimal(energy),
          unit,
          // A personal correction must not silently carry an incompatible nutrient basis.
          nutrients100: isCustom
            ? ownNutrients(d)
            : food.kcal100 !== decimal(energy) ||
                (food.unit !== null && food.unit !== unit)
              ? undefined
              : food.nutrients100,
          originalEnergy:
            food.kcal100 !== decimal(energy) ? undefined : food.originalEnergy,
          names: corrected ? undefined : food.names,
          portionNames:
            val(d, "portionName") !== food.portionName
              ? undefined
              : food.portionNames,
          portion: portion ? decimal(portion, false) : null,
          portionName: val(d, "portionName") || food.portionName,
          source: corrected ? "Egen registrering" : food.source,
          sourceId: corrected ? food.id : food.sourceId,
          confirmed: true,
          favorite: d.get("favorite") === "on",
        });
        const chosenDate = val(d, "date") || date;
        const consumed = onlySave ? 0 : decimal(amount, false);
        if (
          await save(
            (s) => {
              put(s.foods, f);
              if (!onlySave) {
                if (
                  s.modes.find((x) => x.date === chosenDate)?.mode === "manual"
                )
                  throw Error(
                    "Denne datoen bruker manuell kaloritotal. Bytt til matregistreringer først; eksisterende data blir beholdt.",
                  );
                put(s.logs, {
                  id: entry?.id ?? id(),
                  date: chosenDate,
                  food: structuredClone(f),
                  amount: consumed,
                  kcal: kcal(f, consumed),
                  group: val(d, "group") as FoodLog["group"],
                  note: entry?.note ?? "",
                });
              }
            },
            t(onlySave ? "Produktet er lagret" : "Maten er logget"),
          )
        )
          close();
      }}
    >
      {isCustom && (
        <Field label={t("Produktnavn")}>
          <input
            name="name"
            required
            defaultValue={
              saveOnly && ["Nytt produkt", "New product"].includes(food.name)
                ? ""
                : food.name
            }
            maxLength={250}
            placeholder={t("For eksempel yoghurten min")}
          />
        </Field>
      )}
      {!isCustom && (
        <div className="food-identity">
          <span className="soft-icon peach">
            <Utensils size={22} />
          </span>
          <div>
            <h3>{foodName(food)}</h3>
            <p>
              {food.brand}
              {food.packageSize ? ` · ${food.packageSize}` : ""}
            </p>
            <small>{t("Kilde: {source}", { source: t(food.source) })}</small>
          </div>
        </div>
      )}
      {isCustom && (
        <p className="help">
          {t(
            "Skriv av kcal (ikke kJ) fra emballasjen, og velg om tallet gjelder 100 g eller 100 ml. Produktet lagres bare hos deg.",
          )}
        </p>
      )}
      {food.source === "Matvaretabellen" && (
        <p className="notice">
          {t(
            "Verdien gjelder 100 g spiselig del. Velg riktig variant: rå, kokt og tørr mat kan ha svært ulikt kaloriinnhold.",
          )}
        </p>
      )}
      {food.source === "Open Food Facts" && (
        <p className="notice">
          {t(
            "Kontroller kcal mot etiketten og riktig variant (som solgt eller tilberedt). Gjelder verdien per 100 g eller per 100 ml? Vi gjetter ikke måleenheten. Bekreft opplysningene nedenfor.",
          )}
        </p>
      )}
      {!isCustom && food.kcal100 === null && (
        <p className="notice">
          {t(
            "Kaloriverdien mangler eller er usikker. Fyll inn kcal fra etiketten for å fortsette.",
          )}
        </p>
      )}
      {food.originalEnergy?.unit === "kJ" && (
        <p className="help">
          {t(
            "Kilden oppgir {value} kJ per 100. Kcal er beregnet som kJ ÷ 4,184.",
            { value: num(food.originalEnergy.value) },
          )}
        </p>
      )}
      <div className="form-row">
        <Field label={t("kcal per 100")}>
          <input
            inputMode="decimal"
            required
            aria-label={t("kcal per 100")}
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
          />
        </Field>
        <Field label={t("Næringsgrunnlag")}>
          <select
            required
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as "g" | "ml");
              setPortion("");
              setAmount("");
            }}
          >
            <option value="">{t("Velg fra etiketten")}</option>
            <option value="g">{t("Per 100 gram")}</option>
            <option value="ml">{t("Per 100 milliliter")}</option>
          </select>
        </Field>
      </div>
      {saveOnly && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={logNow}
            onChange={(e) => setLogNow(e.target.checked)}
          />
          {t("Logg også det jeg spiste")}
        </label>
      )}
      {!onlySave && (
        <>
          <Field
            label={
              unit
                ? t("Mengde spist eller drukket ({unit})", { unit })
                : t("Mengde spist eller drukket")
            }
          >
            <input
              inputMode="decimal"
              autoFocus
              required
              placeholder={t("Skriv mengde")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          {food.portion && unit === food.unit && (
            <button
              type="button"
              className="text-button"
              onClick={() => setAmount(inputNumber(food.portion))}
            >
              {food.portionNames?.[getLanguage()] ||
                (food.portionName === "Porsjon"
                  ? t("Porsjon")
                  : food.portionName)}
              : {num(food.portion)} {food.unit}
            </button>
          )}
          <div className="portion-preview">
            <span>{t("Denne registreringen")}</span>
            <strong>
              {preview === null ? "—" : num(preview)} <small>{t("kcal")}</small>
            </strong>
          </div>
          {food.nutrients100 && preview !== null && (
            <Nutrition
              food={{
                ...food,
                unit: food.unit ?? (unit || null),
                nutrients100:
                  !isCustom && !sourceNutrientsMatch
                    ? undefined
                    : food.nutrients100,
              }}
              amount={decimal(amount, false)}
              unit={unit || null}
            />
          )}
          <div className="form-row">
            <Field label={t("Dato")}>
              <input
                name="date"
                type="date"
                defaultValue={entry?.date ?? date}
                required
              />
            </Field>
            <Field label={t("Måltid")}>
              <select name="group" defaultValue={entry?.group ?? "Annet"}>
                {["Frokost", "Lunsj", "Middag", "Mellommåltid", "Annet"].map(
                  (x) => (
                    <option key={x} value={x}>
                      {t(x)}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        </>
      )}
      <details className="form-details">
        <summary>{t("Husk en porsjon")}</summary>
        <div className="form-row">
          <Field label={t("Navn på porsjonen")}>
            <input
              name="portionName"
              defaultValue={
                food.portionNames?.[getLanguage()] ||
                (food.portionName === "Porsjon"
                  ? t("Porsjon")
                  : food.portionName)
              }
              placeholder={t("For eksempel én boks")}
            />
          </Field>
          <Field
            label={t("Mengde per porsjon ({unit})", { unit: unit || "g / ml" })}
          >
            <input
              inputMode="decimal"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              placeholder={t("Må være kjent")}
            />
          </Field>
        </div>
      </details>
      <details className="form-details">
        <summary>
          {t(
            isCustom
              ? "Næringsinnhold per 100"
              : "Opprinnelig næringsinnhold per 100",
          )}
        </summary>
        {isCustom ? (
          <div className="food-nutrient-inputs">
            {nutrientLabels.map(([key, label]) => (
              <Field
                key={key}
                label={t("{nutrient} (g)", { nutrient: t(label) })}
              >
                <input
                  name={`nutrient-${key}`}
                  inputMode="decimal"
                  defaultValue={inputNumber(food.nutrients100?.[key])}
                  placeholder={t("Ukjent")}
                />
              </Field>
            ))}
          </div>
        ) : (
          <Nutrition
            food={{ ...food, unit: food.unit ?? (unit || null) }}
            unit={food.unit ?? (unit || null)}
          />
        )}
        <p className="help">
          {t("Ukjente næringsverdier regnes ikke som null.")}
        </p>
      </details>
      <label className="check-label">
        <input
          type="checkbox"
          name="favorite"
          defaultChecked={food.favorite || (isCustom && saveOnly)}
        />
        {t("Lagre som favoritt")}
      </label>
      {food.url.startsWith("https://") && (
        <a
          className="text-link"
          href={food.url}
          target="_blank"
          rel="noreferrer"
        >
          {t("Se opprinnelig kilde")}
          <ExternalLink size={13} />
        </a>
      )}
      <p className="help">
        {t(
          "Lagres som et øyeblikksbilde. Senere produktendringer endrer ikke historikken din.",
        )}
      </p>
    </Form>
  );
}
export function MealEntryForm({
  entry,
  save,
  close,
}: {
  entry: FoodLog;
  save: Save;
  close: () => void;
}) {
  useI18n();
  return (
    <Form
      cancel={close}
      label={t("Oppdater måltid")}
      onSubmit={async (d) => {
        const amount = decimal(val(d, "amount"), false);
        const updated = {
          ...entry,
          date: val(d, "date"),
          amount,
          kcal: kcal(entry.food, amount),
          group: val(d, "group") as FoodLog["group"],
        };
        if (
          await save((s) => {
            if (s.modes.find((x) => x.date === updated.date)?.mode === "manual")
              throw Error("Bytt til matregistreringer for denne datoen først.");
            put(s.logs, updated);
          }, t("Måltidet er oppdatert"))
        )
          close();
      }}
    >
      <p className="notice">
        {t(
          "Bruker næringsverdiene fra det opprinnelige måltidet. Senere endringer i oppskriften påvirker ikke denne registreringen.",
        )}
      </p>
      <Field label={t("Porsjoner spist")}>
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={inputNumber(entry.amount)}
        />
      </Field>
      <Field label={t("Dato")}>
        <input type="date" name="date" required defaultValue={entry.date} />
      </Field>
      <Field label={t("Måltid")}>
        <select name="group" defaultValue={entry.group}>
          {["Frokost", "Lunsj", "Middag", "Mellommåltid", "Annet"].map((x) => (
            <option key={x} value={x}>
              {t(x)}
            </option>
          ))}
        </select>
      </Field>
    </Form>
  );
}
export function ManualCalories({
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
  const current = state.modes.find((x) => x.date === date);
  const [mode, setMode] = useState(current?.mode ?? "items");
  return (
    <Form
      cancel={close}
      onSubmit={async (d) => {
        const total =
          mode === "manual"
            ? decimal(val(d, "total"))
            : (current?.total ?? null);
        if (
          await save(
            (s) => put(s.modes, { date, mode, total }, "date"),
            t("Registreringsmåten er oppdatert"),
          )
        )
          close();
      }}
    >
      <Field label={t("Hvordan vil du føre kalorier denne dagen?")}>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "items" | "manual")}
        >
          <option value="items">
            {t("Tell individuelle matregistreringer")}
          </option>
          <option value="manual">{t("Skriv én kaloritotal")}</option>
        </select>
      </Field>
      {mode === "manual" && (
        <Field label={t("Dagens totale kcal")}>
          <input
            name="total"
            inputMode="decimal"
            required
            defaultValue={inputNumber(current?.total)}
          />
        </Field>
      )}
      <p className="notice">
        {t(
          "Alle matregistreringer beholdes. I manuell modus telles bare dagstotalen. Bytter du tilbake, telles bare matregistreringene. Ingenting dobbelttelles eller slettes.",
        )}
      </p>
      <p className="help">
        {t("Lagrede matregistreringer på denne datoen: {count}.", {
          count: num(state.logs.filter((x) => x.date === date).length),
        })}
      </p>
    </Form>
  );
}
function Scanner({ onCode }: { onCode: (code: string) => void }) {
  useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop.current?.();
    };
  }, []);
  async function start() {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "Kamera krever HTTPS og en støttet nettleser. Skriv inn strekkoden nedenfor.",
      );
      return;
    }
    setActive(true);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!mounted.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" }, audio: false },
        video.current!,
        (result) => {
          if (result && mounted.current) {
            stop.current?.();
            setActive(false);
            onCode(result.getText());
          }
        },
      );
      if (!mounted.current) {
        controls.stop();
        return;
      }
      stop.current = () => {
        controls.stop();
        const stream = video.current?.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
      };
    } catch {
      if (mounted.current) {
        setError(
          "Kameraet kunne ikke åpnes. Tillat kameratilgang, eller skriv strekkoden nedenfor.",
        );
        setActive(false);
      }
    }
  }
  return (
    <div className="scanner">
      <video ref={video} autoPlay muted playsInline hidden={!active} />
      {!active ? (
        <Btn type="button" secondary onClick={start}>
          <Camera size={18} />
          {t("Åpne kamera")}
        </Btn>
      ) : (
        <Btn
          type="button"
          secondary
          onClick={() => {
            stop.current?.();
            setActive(false);
          }}
        >
          {t("Stopp kamera")}
        </Btn>
      )}
      {error && (
        <p role="alert" className="error-box">
          {t(error)}
        </p>
      )}
      <p className="help">
        {t(
          "Bildene behandles på enheten. Bare strekkoden sendes til Open Food Facts.",
        )}
      </p>
    </div>
  );
}
export function RecipeForm({
  state,
  recipe,
  save,
  close,
}: {
  state: State;
  recipe?: Meal;
  save: Save;
  close: () => void;
}) {
  useI18n();
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? []);
  const usable = state.foods.filter(
    (f) =>
      f.kcal100 !== null && f.unit !== null && f.source !== "Lagret måltid",
  );
  const [selected, setSelected] = useState(usable[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  return (
    <Form
      cancel={close}
      label={t("Lagre måltid")}
      onSubmit={async (d) => {
        if (!ingredients.length) throw Error("Legg til minst én ingrediens.");
        const meal: Meal = {
          id: recipe?.id ?? id(),
          name: val(d, "name"),
          servings: decimal(val(d, "servings"), false),
          ingredients: structuredClone(ingredients),
        };
        if (await save((s) => put(s.meals, meal), t("Måltidet er lagret")))
          close();
      }}
    >
      <Field label={t("Navn på måltidet")}>
        <input
          name="name"
          required
          maxLength={150}
          defaultValue={recipe?.name}
        />
      </Field>
      <Field label={t("Antall porsjoner i hele oppskriften")}>
        <input
          name="servings"
          inputMode="decimal"
          required
          defaultValue={inputNumber(recipe?.servings ?? 1)}
        />
      </Field>
      <p className="help">
        {t(
          "Ingredienser hentes fra dine lagrede matvarer. Søk opp eller lagre produkter først.",
        )}
      </p>
      {usable.length > 0 && (
        <>
          <Field label={t("Ingrediens")}>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {usable.map((f) => (
                <option key={f.id} value={f.id}>
                  {foodName(f)} ({f.unit})
                </option>
              ))}
            </select>
          </Field>
          <div className="form-row">
            <Field
              label={t("Mengde ({unit})", {
                unit: usable.find((x) => x.id === selected)?.unit ?? "g",
              })}
            >
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Btn
              type="button"
              secondary
              onClick={() => {
                try {
                  const food = usable.find((x) => x.id === selected)!;
                  const n = decimal(amount, false);
                  kcal(food, n);
                  setIngredients((a) => [
                    ...a,
                    { food: structuredClone(food), amount: n },
                  ]);
                  setAmount("");
                  setError("");
                } catch {
                  setError("Velg en ingrediens og gyldig mengde.");
                }
              }}
            >
              <Plus size={16} />
              {t("Legg til")}
            </Btn>
          </div>
        </>
      )}
      {error && <p className="error-box">{t(error)}</p>}
      {ingredients.map((item, i) => (
        <div className="record" key={i}>
          <div className="record-text">
            <strong>{foodName(item.food)}</strong>
            <small>
              {num(item.amount)} {item.food.unit} ·{" "}
              {num(kcal(item.food, item.amount))} {t("kcal")}
            </small>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Fjern {name}", { name: foodName(item.food) })}
            onClick={() => setIngredients((a) => a.filter((_, j) => j !== i))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <p className="help">
        {t("Endringer påvirker bare fremtidige registreringer.")}
      </p>
    </Form>
  );
}
export function LogRecipe({
  recipe,
  date,
  save,
  close,
}: {
  recipe: Meal;
  date: string;
  save: Save;
  close: () => void;
}) {
  useI18n();
  const total = recipe.ingredients.reduce(
    (a, x) => a + kcal(x.food, x.amount),
    0,
  );
  const per = total / recipe.servings;
  return (
    <Form
      cancel={close}
      label={t("Logg måltid")}
      onSubmit={async (d) => {
        const servings = decimal(val(d, "servings"), false);
        const date = val(d, "date");
        const snapshot: Food = foodSchema.parse({
          id: `meal:${recipe.id}`,
          name: recipe.name,
          source: "Lagret måltid",
          sourceId: recipe.id,
          kcal100: per * 100,
          unit: "portion",
          confirmed: true,
        });
        if (
          await save((s) => {
            if (s.modes.find((x) => x.date === date)?.mode === "manual")
              throw Error(
                "Bytt fra manuell kaloritotal til matregistreringer for denne datoen først.",
              );
            s.logs.push({
              id: id(),
              date,
              food: snapshot,
              amount: servings,
              kcal: kcal(snapshot, servings),
              group: val(d, "group") as FoodLog["group"],
              note: t("{servings} porsjoner. Oppskrift: {ingredients}", {
                servings: num(servings),
                ingredients: recipe.ingredients
                  .map((x) => `${x.food.name}: ${x.amount} ${x.food.unit}`)
                  .join("; ")
                  .slice(0, 800),
              }),
            });
          }, t("Måltidet er logget én gang"))
        )
          close();
      }}
    >
      <p className="notice">
        {t(
          "{calories} kcal per porsjon. Hele måltidet logges som én samlet registrering.",
          { calories: num(per) },
        )}
      </p>
      <Field label={t("Porsjoner spist")}>
        <input
          name="servings"
          inputMode="decimal"
          placeholder={t("For eksempel 1 eller 0,5")}
          required
        />
      </Field>
      <div className="form-row">
        <Field label={t("Dato")}>
          <input name="date" type="date" required defaultValue={date} />
        </Field>
        <Field label={t("Måltid")}>
          <select name="group" defaultValue="Middag">
            {["Frokost", "Lunsj", "Middag", "Mellommåltid", "Annet"].map(
              (x) => (
                <option key={x} value={x}>
                  {t(x)}
                </option>
              ),
            )}
          </select>
        </Field>
      </div>
    </Form>
  );
}
export function FoodLogs({
  state,
  date,
  edit,
  remove,
}: {
  state: State;
  date: string;
  edit: (e: FoodLog) => void;
  remove: (e: FoodLog) => void;
}) {
  useI18n();
  const logs = state.logs.filter((x) => x.date === date);
  const manual = state.modes.find((x) => x.date === date)?.mode === "manual";
  return (
    <>
      {manual && (
        <p className="notice">
          {t(
            "Manuell total: {calories} kcal. Matregistreringene nedenfor er bevart, men telles ikke.",
            { calories: num(dailyCalories(state, date) ?? 0) },
          )}
        </p>
      )}
      {!logs.length ? (
        <Empty title={t("Hva står på menyen?")} icon={<Utensils size={25} />}>
          {t("Søk etter maten du har spist, velg mengde og logg den.")}
        </Empty>
      ) : (
        logs.map((log) => (
          <div className="record" key={log.id}>
            <span className="record-icon peach">
              <Utensils size={17} />
            </span>
            <div className="record-text">
              <strong>{foodName(log.food)}</strong>
              <small>
                {t(log.group)} ·{" "}
                {log.food.source === "Lagret måltid"
                  ? t(
                      log.amount === 1
                        ? "{count} porsjon"
                        : "{count} porsjoner",
                      { count: num(log.amount) },
                    )
                  : `${num(log.amount)} ${log.food.unit}`}{" "}
                · {t(log.food.source)}
              </small>
            </div>
            <strong>
              {num(log.kcal)} <small>{t("kcal")}</small>
            </strong>
            {
              <button
                className="icon-button quiet"
                aria-label={t("Rediger {name}", { name: foodName(log.food) })}
                onClick={() => edit(log)}
              >
                <Pencil size={14} />
              </button>
            }
            <button
              className="icon-button quiet"
              aria-label={t("Slett {name}", { name: foodName(log.food) })}
              onClick={() => remove(log)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </>
  );
}
export function FoodPage({
  state,
  date,
  setDate,
  save,
  pick,
  custom,
  edit,
  remove,
  manual,
  recipe,
  logRecipe,
  initialScan = false,
}: {
  state: State;
  date: string;
  setDate: (s: string) => void;
  save: Save;
  pick: (f: Food) => void;
  custom: () => void;
  edit: (e: FoodLog) => void;
  remove: (e: FoodLog) => void;
  manual: () => void;
  recipe: (m?: Meal) => void;
  logRecipe: (m: Meal) => void;
  initialScan?: boolean;
}) {
  const { language } = useI18n();
  const [query, setQuery] = useState("");
  const market = state.settings.foodMarket;
  const [results, setResults] = useState<Food[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<SearchIssue[]>([]);
  const [searched, setSearched] = useState(false);
  const [scan, setScan] = useState(initialScan);
  const [code, setCode] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(value = query, isBarcode = false) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setIssues([]);
    setResults([]);
    setSearched(true);
    try {
      const update = (found: FoodSearchResult) => {
        if (!c.signal.aborted) {
          setResults(found.foods.map((f) => preferredFood(f, state.foods)));
          setIssues(found.issues);
        }
      };
      const found = await searchFoods(
        value,
        c.signal,
        { barcode: isBarcode, market, language },
        update,
      );
      if (!c.signal.aborted) {
        if (isBarcode && found.foods.length === 1) {
          setScan(false);
          pick(preferredFood(found.foods[0], state.foods));
        }
      }
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Kunne ikke søke.");
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const local = state.foods.filter((f) => foodMatches(f, query));
  function rows(foods: Food[]) {
    return foods.length ? (
      <div className="food-results">
        {foods.map((f) => (
          <div className="food-result" key={f.id}>
            {f.image ? (
              <img src={f.image} alt="" width={42} height={42} loading="lazy" />
            ) : (
              <span className="record-icon peach">
                <Utensils size={19} />
              </span>
            )}
            <button className="food-pick" onClick={() => pick(f)}>
              <strong>{foodName(f)}</strong>
              <small>
                {[f.brand, f.packageSize].filter(Boolean).join(" · ") ||
                  t(f.source)}
              </small>
              <span>
                {f.kcal100 === null
                  ? t("Kaloriverdi mangler")
                  : t("{calories} kcal / 100 {unit}", {
                      calories: num(f.kcal100),
                      unit: f.unit ?? t("g eller ml · bekreft"),
                    })}{" "}
                · {t(f.source)}
              </span>
              <span>
                {f.source === "Matvaretabellen"
                  ? t("Generell matvare · Norge")
                  : f.source === "Egen registrering"
                    ? t("Ditt eget produkt")
                    : f.markets?.length
                      ? t("Marked: {markets}", {
                          markets: f.markets
                            .map((m) =>
                              m === "en:norway"
                                ? t("Norge")
                                : m
                                    .replace(/^[a-z]{2}:/, "")
                                    .replaceAll("-", " "),
                            )
                            .join(", "),
                        })
                      : t("Marked er ikke oppgitt")}
              </span>
            </button>
            <button
              className={`icon-button quiet ${state.foods.find((x) => x.id === f.id)?.favorite ? "favorite" : ""}`}
              aria-label={t("Favoritt: {name}", { name: foodName(f) })}
              aria-pressed={
                state.foods.find((x) => x.id === f.id)?.favorite ?? false
              }
              onClick={() =>
                save((s) => {
                  const current = s.foods.find((x) => x.id === f.id);
                  put(s.foods, {
                    ...f,
                    ...current,
                    favorite: !current?.favorite,
                  });
                }, t("Favoritter er oppdatert"))
              }
            >
              <Star size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Velg {name}", { name: foodName(f) })}
              onClick={() => pick(f)}
            >
              <Plus size={17} />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <Empty title={t("Ingen matvarer her ennå")}>
        {t("Søk i en matkilde eller lag ditt eget produkt.")}
      </Empty>
    );
  }
  return (
    <>
      <div className="page-toolbar">
        <DatePicker value={date} onChange={setDate} />
        <div className="actions">
          <Btn secondary onClick={() => setScan((v) => !v)}>
            <ScanLine size={17} />
            {t("Skann")}
          </Btn>
        </div>
      </div>
      <section className="custom-food-callout" aria-label={t("Eget produkt")}>
        <div>
          <h2>{t("Din mat. Tall fra etiketten.")}</h2>
          <p>
            {t(
              "Legg inn navn og kalorier selv. Lagre én gang, bruk igjen uten nett.",
            )}
          </p>
        </div>
        <Btn onClick={custom}>
          <Plus size={18} />
          {t("Legg inn eget produkt")}
        </Btn>
      </section>
      <div className="food-layout">
        <section className="panel">
          <h2>{t("Finn maten din")}</h2>
          <form
            className="food-search"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <label className="search-field">
              <Search size={19} />
              <input
                aria-label={t("Søk etter mat")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Matvare, produkt eller merke …")}
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <Btn disabled={busy}>{t(busy ? "Søker …" : "Søk")}</Btn>
          </form>
          <Field label={t("Matmarked")}>
            <select
              value={market}
              onChange={async (e) => {
                controller.current?.abort();
                setBusy(false);
                setError("");
                setIssues([]);
                setResults([]);
                setSearched(false);
                const next = e.target.value as "no" | "world";
                await save((s) => {
                  s.settings.foodMarket = next;
                }, t("Matmarkedet er oppdatert"));
              }}
            >
              <option value="no">{t("Norge først")}</option>
              <option value="world">{t("Alle markeder")}</option>
            </select>
          </Field>
          <p className="help">
            {t(
              "Ett søk i Matvaretabellen og Open Food Facts. Skriv norsk eller engelsk, og trykk Søk. Markedet endres ikke når du bytter språk.",
            )}
          </p>
          {scan && (
            <section className="scan-area">
              <Scanner
                onCode={(c) => {
                  setCode(c);
                  search(c, true);
                }}
              />
              <form
                className="food-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  search(code, true);
                }}
              >
                <Field label={t("Skriv strekkoden")}>
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    pattern="[0-9]{7,14}"
                    required
                  />
                </Field>
                <Btn disabled={busy}>{t("Finn produkt")}</Btn>
              </form>
            </section>
          )}
          {busy && (
            <p className="search-status" role="status">
              {t("Henter matvarer … Tilgjengelige treff vises med en gang.")}
            </p>
          )}
          {error && (
            <div className="error-box" role="alert">
              {t(error)}
            </div>
          )}
          {issues.map((issue) => (
            <p className="notice" role="status" key={issue.source}>
              {issue.source}: {t(issue.message)}
            </p>
          ))}
          {searched && !error && (results.length > 0 || !busy) && (
            <div className="external-results">
              <div className="section-head">
                <h3>{t("Søkeresultater")}</h3>
                <span className="subtle" role="status">
                  {t(results.length === 1 ? "Ett treff" : "{count} treff", {
                    count: num(results.length),
                  })}
                </span>
              </div>
              {results.length ? (
                rows(results)
              ) : (
                <Empty
                  title={t(
                    issues.length
                      ? "Noen matkilder svarte ikke"
                      : "Fant ikke produktet",
                  )}
                >
                  {t(
                    issues.length
                      ? "Prøv søket igjen, bruk lagrede matvarer eller lag eget produkt."
                      : "Prøv et annet navn, eller lag ditt eget produkt.",
                  )}{" "}
                  <button className="text-button" onClick={custom}>
                    {t("lag eget produkt")}
                  </button>
                  .
                </Empty>
              )}
            </div>
          )}
          <Tabs defaultValue="saved" className="food-tabs">
            <TabsList>
              <TabsTrigger value="saved">
                {t("Lagrede ({count})", { count: num(local.length) })}
              </TabsTrigger>
              <TabsTrigger value="favorites">{t("Favoritter")}</TabsTrigger>
              <TabsTrigger value="recent">{t("Nylig")}</TabsTrigger>
              <TabsTrigger value="meals">{t("Måltider")}</TabsTrigger>
            </TabsList>
            <TabsContent value="saved">{rows(local)}</TabsContent>
            <TabsContent value="favorites">
              {rows(local.filter((f) => f.favorite))}
            </TabsContent>
            <TabsContent value="recent">
              {rows(
                Array.from(
                  new Map(
                    [...state.logs].reverse().map((l) => [l.food.id, l.food]),
                  ).values(),
                )
                  .filter((f) => f.source !== "Lagret måltid")
                  .slice(0, 12),
              )}
            </TabsContent>
            <TabsContent value="meals">
              <button className="text-button" onClick={() => recipe()}>
                <Plus size={16} />
                {t("Lag et måltid")}
              </button>
              {state.meals.map((m) => (
                <div key={m.id} className="record">
                  <div className="record-text">
                    <strong>{m.name}</strong>
                    <small>
                      {num(
                        m.ingredients.reduce(
                          (a, x) => a + kcal(x.food, x.amount),
                          0,
                        ) / m.servings,
                      )}{" "}
                      {t("kcal per porsjon")}
                    </small>
                  </div>
                  <button
                    className="icon-button quiet"
                    aria-label={t("Endre {name}", { name: m.name })}
                    onClick={() => recipe(m)}
                  >
                    <Pencil size={15} />
                  </button>
                  <Btn secondary onClick={() => logRecipe(m)}>
                    {t("Logg")}
                  </Btn>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </section>
        <section className="panel food-diary">
          <div className="section-head">
            <h2>{t("Matdagbok")}</h2>
            <button className="text-button" onClick={manual}>
              {t("Føringsmåte")}
            </button>
          </div>
          <div className="calorie-total">
            <strong>
              {dailyCalories(state, date) === null
                ? "—"
                : num(dailyCalories(state, date)!)}
            </strong>
            <span>{t("kcal registrert")}</span>
          </div>
          <FoodLogs state={state} date={date} edit={edit} remove={remove} />
        </section>
      </div>
      <p className="help section-note">
        {t("Kilder:")}{" "}
        <a
          href="https://www.matvaretabellen.no/api/"
          target="_blank"
          rel="noreferrer"
        >
          {t("Matvaretabellen")}
        </a>{" "}
        {t("og")}{" "}
        <a
          href="https://world.openfoodfacts.org/terms-of-use"
          target="_blank"
          rel="noreferrer"
        >
          {t("Open Food Facts (ODbL; bilder CC BY-SA)")}
        </a>
        {t(
          ". Opplysningene kan inneholde feil. Kontroller produkt og mengde. Lagrede matvarer virker også uten nett.",
        )}
      </p>
    </>
  );
}
