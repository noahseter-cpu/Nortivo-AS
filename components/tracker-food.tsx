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
  ArrowRight,
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
  dailyCalories,
} from "@/lib/tracker-core";
import { searchFood } from "@/lib/food-search";
import {
  Btn,
  Empty,
  Field,
  Form,
  DatePicker,
  Modal,
  val,
  optional,
  type Save,
} from "./tracker-shared";
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
  const [energy, setEnergy] = useState(
    food.kcal100 === null ? "" : String(food.kcal100),
  );
  const [unit, setUnit] = useState<"g" | "ml" | "">(
    food.unit === "g" || food.unit === "ml" ? food.unit : "",
  );
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [portion, setPortion] = useState(
    food.portion === null ? "" : String(food.portion),
  );
  const isCustom = food.source === "Egen registrering";
  let preview: number | null = null;
  try {
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
      label={saveOnly ? "Lagre produkt" : "Logg maten"}
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
          portion: portion ? decimal(portion, false) : null,
          portionName: val(d, "portionName") || food.portionName,
          source: corrected ? "Egen registrering" : food.source,
          sourceId: corrected ? food.id : food.sourceId,
          confirmed: true,
          favorite: d.get("favorite") === "on",
        });
        const chosenDate = val(d, "date") || date;
        const consumed = saveOnly ? 0 : decimal(amount, false);
        if (
          await save(
            (s) => {
              put(s.foods, f);
              if (!saveOnly) {
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
                  note: "",
                });
              }
            },
            saveOnly ? "Produktet er lagret" : "Maten er logget",
          )
        )
          close();
      }}
    >
      {isCustom && (
        <Field label="Produktnavn">
          <input
            name="name"
            required
            defaultValue={food.name === "Nytt produkt" ? "" : food.name}
            maxLength={250}
          />
        </Field>
      )}
      <div className="food-identity">
        <span className="soft-icon peach">
          <Utensils size={22} />
        </span>
        <div>
          <h3>{food.name}</h3>
          <p>
            {food.brand}
            {food.packageSize ? ` · ${food.packageSize}` : ""}
          </p>
          <small>Kilde: {food.source}</small>
        </div>
      </div>
      {food.source === "Open Food Facts" && (
        <p className="notice">
          Kontroller etiketten: gjelder verdien per 100 g eller per 100 ml? Vi
          gjetter ikke måleenheten. Bekreft opplysningene nedenfor.
        </p>
      )}
      {food.kcal100 === null && (
        <p className="notice">
          Produktet mangler kaloriverdi. Fyll inn kcal fra etiketten for å
          fortsette.
        </p>
      )}
      <div className="form-row">
        <Field label="kcal per 100">
          <input
            inputMode="decimal"
            required
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
          />
        </Field>
        <Field label="Næringsgrunnlag">
          <select
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value as "g" | "ml")}
          >
            <option value="">Velg fra etiketten</option>
            <option value="g">Per 100 gram</option>
            <option value="ml">Per 100 milliliter</option>
          </select>
        </Field>
      </div>
      {!saveOnly && (
        <>
          <Field
            label={`Mengde spist eller drukket${unit ? ` (${unit})` : ""}`}
          >
            <input
              inputMode="decimal"
              autoFocus
              required
              placeholder="Skriv mengde"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          {food.portion && (
            <button
              type="button"
              className="text-button"
              onClick={() => setAmount(String(food.portion))}
            >
              {food.portionName}: {num(food.portion)} {food.unit}
            </button>
          )}
          <div className="portion-preview">
            <span>Denne registreringen</span>
            <strong>
              {preview === null ? "—" : num(preview)} <small>kcal</small>
            </strong>
          </div>
          <div className="form-row">
            <Field label="Dato">
              <input
                name="date"
                type="date"
                defaultValue={entry?.date ?? date}
                required
              />
            </Field>
            <Field label="Måltid">
              <select name="group" defaultValue={entry?.group ?? "Annet"}>
                {["Frokost", "Lunsj", "Middag", "Mellommåltid", "Annet"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </Field>
          </div>
        </>
      )}
      <details className="form-details">
        <summary>Husk en porsjon</summary>
        <div className="form-row">
          <Field label="Navn på porsjonen">
            <input
              name="portionName"
              defaultValue={food.portionName}
              placeholder="For eksempel én boks"
            />
          </Field>
          <Field label={`Mengde per porsjon (${unit || "g / ml"})`}>
            <input
              inputMode="decimal"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              placeholder="Må være kjent"
            />
          </Field>
        </div>
      </details>
      <label className="check-label">
        <input type="checkbox" name="favorite" defaultChecked={food.favorite} />
        Lagre som favoritt
      </label>
      {food.url.startsWith("https://") && (
        <a
          className="text-link"
          href={food.url}
          target="_blank"
          rel="noreferrer"
        >
          Se opprinnelig kilde <ExternalLink size={13} />
        </a>
      )}
      <p className="help">
        Lagres som et øyeblikksbilde. Senere produktendringer endrer ikke
        historikken din.
      </p>
    </Form>
  );
}
export function MealEntryForm({entry,save,close}:{entry:FoodLog;save:Save;close:()=>void}) {
  return <Form cancel={close} label="Oppdater måltid" onSubmit={async d=>{
    const amount=decimal(val(d,"amount"),false);
    const updated={...entry,date:val(d,"date"),amount,kcal:kcal(entry.food,amount),group:val(d,"group") as FoodLog["group"]};
    if(await save(s=>{if(s.modes.find(x=>x.date===updated.date)?.mode==="manual")throw Error("Bytt til matregistreringer for denne datoen først.");put(s.logs,updated)},"Måltidet er oppdatert"))close();
  }}><p className="notice">Bruker næringsverdiene fra det opprinnelige måltidet. Senere endringer i oppskriften påvirker ikke denne registreringen.</p><Field label="Porsjoner spist"><input name="amount" inputMode="decimal" required defaultValue={entry.amount}/></Field><Field label="Dato"><input type="date" name="date" required defaultValue={entry.date}/></Field><Field label="Måltid"><select name="group" defaultValue={entry.group}>{["Frokost","Lunsj","Middag","Mellommåltid","Annet"].map(x=><option key={x}>{x}</option>)}</select></Field></Form>
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
            "Registreringsmåten er oppdatert",
          )
        )
          close();
      }}
    >
      <Field label="Hvordan vil du føre kalorier denne dagen?">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "items" | "manual")}
        >
          <option value="items">Tell individuelle matregistreringer</option>
          <option value="manual">Skriv én kaloritotal</option>
        </select>
      </Field>
      {mode === "manual" && (
        <Field label="Dagens totale kcal">
          <input
            name="total"
            inputMode="decimal"
            required
            defaultValue={current?.total ?? ""}
          />
        </Field>
      )}
      <p className="notice">
        Alle matregistreringer beholdes. I manuell modus telles bare
        dagstotalen. Bytter du tilbake, telles bare matregistreringene.
        Ingenting dobbelttelles eller slettes.
      </p>
      <p className="help">
        {state.logs.filter((x) => x.date === date).length} matregistreringer er
        lagret for denne datoen.
      </p>
    </Form>
  );
}
function Scanner({ onCode }: { onCode: (code: string) => void }) {
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
          Åpne kamera
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
          Stopp kamera
        </Btn>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <p className="help">
        Bildene behandles på enheten. Bare strekkoden sendes til Open Food
        Facts.
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
      label="Lagre måltid"
      onSubmit={async (d) => {
        if (!ingredients.length) throw Error("Legg til minst én ingrediens.");
        const meal: Meal = {
          id: recipe?.id ?? id(),
          name: val(d, "name"),
          servings: decimal(val(d, "servings"), false),
          ingredients: structuredClone(ingredients),
        };
        if (await save((s) => put(s.meals, meal), "Måltidet er lagret"))
          close();
      }}
    >
      <Field label="Navn på måltidet">
        <input
          name="name"
          required
          maxLength={150}
          defaultValue={recipe?.name}
        />
      </Field>
      <Field label="Antall porsjoner i hele oppskriften">
        <input
          name="servings"
          inputMode="decimal"
          required
          defaultValue={recipe?.servings ?? 1}
        />
      </Field>
      <p className="help">
        Ingredienser hentes fra dine lagrede matvarer. Søk opp eller lagre
        produkter først.
      </p>
      {usable.length > 0 && (
        <>
          <Field label="Ingrediens">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {usable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.unit})
                </option>
              ))}
            </select>
          </Field>
          <div className="form-row">
            <Field
              label={`Mengde (${usable.find((x) => x.id === selected)?.unit ?? "g"})`}
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
              Legg til
            </Btn>
          </div>
        </>
      )}
      {error && <p className="error-box">{error}</p>}
      {ingredients.map((item, i) => (
        <div className="record" key={i}>
          <div className="record-text">
            <strong>{item.food.name}</strong>
            <small>
              {num(item.amount)} {item.food.unit} ·{" "}
              {num(kcal(item.food, item.amount))} kcal
            </small>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={`Fjern ${item.food.name}`}
            onClick={() => setIngredients((a) => a.filter((_, j) => j !== i))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <p className="help">Endringer påvirker bare fremtidige registreringer.</p>
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
  const total = recipe.ingredients.reduce(
    (a, x) => a + kcal(x.food, x.amount),
    0,
  );
  const per = total / recipe.servings;
  return (
    <Form
      cancel={close}
      label="Logg måltid"
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
              note: `${servings} porsjon(er). Oppskrift: ${recipe.ingredients
                .map((x) => `${x.food.name}: ${x.amount} ${x.food.unit}`)
                .join("; ")
                .slice(0, 800)}`,
            });
          }, "Måltidet er logget én gang")
        )
          close();
      }}
    >
      <p className="notice">
        {num(per)} kcal per porsjon. Hele måltidet logges som én samlet
        registrering.
      </p>
      <Field label="Porsjoner spist">
        <input
          name="servings"
          inputMode="decimal"
          placeholder="For eksempel 1 eller 0,5"
          required
        />
      </Field>
      <div className="form-row">
        <Field label="Dato">
          <input name="date" type="date" required defaultValue={date} />
        </Field>
        <Field label="Måltid">
          <select name="group" defaultValue="Middag">
            {["Frokost", "Lunsj", "Middag", "Mellommåltid", "Annet"].map(
              (x) => (
                <option key={x}>{x}</option>
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
  const logs = state.logs.filter((x) => x.date === date);
  const manual = state.modes.find((x) => x.date === date)?.mode === "manual";
  return (
    <>
      {manual && (
        <p className="notice">
          Manuell total: {num(dailyCalories(state, date) ?? 0)} kcal.
          Matregistreringene nedenfor er bevart, men telles ikke.
        </p>
      )}
      {!logs.length ? (
        <Empty title="Hva står på menyen?" icon={<Utensils size={25} />}>
          Søk etter maten du har spist, velg mengde og logg den.
        </Empty>
      ) : (
        logs.map((log) => (
          <div className="record" key={log.id}>
            <span className="record-icon peach">
              <Utensils size={17} />
            </span>
            <div className="record-text">
              <strong>{log.food.name}</strong>
              <small>
                {log.group} ·{" "}
                {log.food.source === "Lagret måltid"
                  ? `${num(log.amount)} porsjon(er)`
                  : `${num(log.amount)} ${log.food.unit}`}{" "}
                · {log.food.source}
              </small>
            </div>
            <strong>
              {num(log.kcal)} <small>kcal</small>
            </strong>
            {(
              <button
                className="icon-button quiet"
                aria-label={`Rediger ${log.food.name}`}
                onClick={() => edit(log)}
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              className="icon-button quiet"
              aria-label={`Slett ${log.food.name}`}
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
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<"mvt" | "off">("mvt");
  const [results, setResults] = useState<Food[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    setSearched(true);
    try {
      const found = await searchFood(
        isBarcode ? "off" : provider,
        value,
        c.signal,
        isBarcode,
      );
      if (!c.signal.aborted) {
        setResults(found);
        if (isBarcode && found.length === 1) {
          setScan(false);
          pick(found[0]);
        }
      }
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Kunne ikke søke.");
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const local = state.foods.filter((f) =>
    `${f.name} ${f.brand}`
      .toLocaleLowerCase("nb")
      .includes(query.toLocaleLowerCase("nb")),
  );
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
              <strong>{f.name}</strong>
              <small>
                {[f.brand, f.packageSize].filter(Boolean).join(" · ") ||
                  f.source}
              </small>
              <span>
                {f.kcal100 === null
                  ? "Kaloriverdi mangler"
                  : `${num(f.kcal100)} kcal / 100 ${f.unit ?? "g eller ml · bekreft"}`}{" "}
                · {f.source}
              </span>
            </button>
            <button
              className={`icon-button quiet ${state.foods.find((x) => x.id === f.id)?.favorite ? "favorite" : ""}`}
              aria-label={`Favoritt: ${f.name}`}
              onClick={() =>
                save((s) => {
                  const current = s.foods.find((x) => x.id === f.id);
                  put(s.foods, {
                    ...f,
                    ...current,
                    favorite: !current?.favorite,
                  });
                }, "Favoritter er oppdatert")
              }
            >
              <Star size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={`Velg ${f.name}`}
              onClick={() => pick(f)}
            >
              <Plus size={17} />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <Empty title="Ingen matvarer her ennå">
        Søk i en matkilde eller lag ditt eget produkt.
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
            Skann
          </Btn>
          <Btn onClick={custom}>
            <Plus size={17} />
            Eget produkt
          </Btn>
        </div>
      </div>
      <div className="food-layout">
        <section className="panel">
          <h2>Finn maten din</h2>
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
                aria-label="Søk etter mat"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Matvare, produkt eller merke …"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <Btn disabled={busy}>{busy ? "Søker …" : "Søk"}</Btn>
          </form>
          <div className="source-selector">
            <label>
              <input
                type="radio"
                name="source"
                checked={provider === "mvt"}
                onChange={() => {
                  setProvider("mvt");
                  setResults([]);
                  setSearched(false);
                }}
              />
              Matvaretabellen
            </label>
            <label>
              <input
                type="radio"
                name="source"
                checked={provider === "off"}
                onChange={() => {
                  setProvider("off");
                  setResults([]);
                  setSearched(false);
                }}
              />
              Open Food Facts
            </label>
          </div>
          <p className="help">
            {provider === "mvt"
              ? "Norske råvarer og tilberedte matvarer."
              : "Pakkevarer, drikke og merkevarer fra flere land."}{" "}
            Søket sendes til valgt matkilde når du trykker Søk.
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
                <Field label="Skriv strekkoden">
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    pattern="[0-9]{7,14}"
                    required
                  />
                </Field>
                <Btn disabled={busy}>Finn produkt</Btn>
              </form>
            </section>
          )}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          {searched && !busy && !error && (
            <div className="external-results">
              <div className="section-head">
                <h3>Søkeresultater</h3>
                <span className="subtle">{results.length} treff</span>
              </div>
              {results.length ? (
                rows(results)
              ) : (
                <Empty title="Fant ikke produktet">
                  Prøv et annet navn, eller{" "}
                  <button className="text-button" onClick={custom}>
                    lag eget produkt
                  </button>
                  .
                </Empty>
              )}
            </div>
          )}
          <Tabs defaultValue="saved" className="food-tabs">
            <TabsList>
              <TabsTrigger value="saved">Lagrede ({local.length})</TabsTrigger>
              <TabsTrigger value="favorites">Favoritter</TabsTrigger>
              <TabsTrigger value="recent">Nylig</TabsTrigger>
              <TabsTrigger value="meals">Måltider</TabsTrigger>
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
                Lag et måltid
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
                      kcal per porsjon
                    </small>
                  </div>
                  <button
                    className="icon-button quiet"
                    aria-label={`Endre ${m.name}`}
                    onClick={() => recipe(m)}
                  >
                    <Pencil size={15} />
                  </button>
                  <Btn secondary onClick={() => logRecipe(m)}>
                    Logg
                  </Btn>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </section>
        <section className="panel food-diary">
          <div className="section-head">
            <h2>Matdagbok</h2>
            <button className="text-button" onClick={manual}>
              Føringsmåte
            </button>
          </div>
          <div className="calorie-total">
            <strong>
              {dailyCalories(state, date) === null
                ? "—"
                : num(dailyCalories(state, date)!)}
            </strong>
            <span>kcal registrert</span>
          </div>
          <FoodLogs state={state} date={date} edit={edit} remove={remove} />
        </section>
      </div>
      <p className="help section-note">
        Kilder:{" "}
        <a
          href="https://www.matvaretabellen.no/api/"
          target="_blank"
          rel="noreferrer"
        >
          Matvaretabellen
        </a>{" "}
        og{" "}
        <a
          href="https://world.openfoodfacts.org/terms-of-use"
          target="_blank"
          rel="noreferrer"
        >
          Open Food Facts (ODbL; bilder CC BY-SA)
        </a>
        . Opplysningene kan inneholde feil. Kontroller produkt og mengde.
        Lagrede matvarer virker også uten nett.
      </p>
    </>
  );
}
