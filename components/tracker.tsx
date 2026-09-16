"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  House,
  Wallet,
  Utensils,
  Footprints,
  History,
  Settings,
  Plus,
  ChevronRight,
  ScanLine,
  ShieldCheck,
  ArrowRight,
  WifiOff,
  X,
  Check,
  SlidersHorizontal,
  CalendarDays,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  type State,
  type Transaction,
  type Food,
  type FoodLog,
  type Meal,
  emptyState,
  today,
  money,
  finances,
  dailyCalories,
  num,
  dateLabel,
  monthLabel,
  weekDates,
  netSpent,
  goalAt,
  balance,
  id,
  foodSchema,
  put,
  shiftDate,
} from "@/lib/tracker-core";
import { registerTrackerTools } from "@/lib/webmcp";
import { readState, updateState } from "@/lib/tracker-store";
import {
  Btn,
  Modal,
  DatePicker,
  Empty,
  Progress,
  Form,
  Field,
  val,
  type Save,
} from "./tracker-shared";
import {
  MoneyPage,
  TransactionForm,
  BudgetForm,
  TransactionList,
} from "./tracker-money";
import {
  FoodPage,
  FoodForm,
  MealEntryForm,
  FoodLogs,
  ManualCalories,
  RecipeForm,
  LogRecipe,
} from "./tracker-food";
import { ActivityPage, ActivityForm } from "./tracker-activity";
import { SettingsPage, GoalsForm } from "./tracker-settings";
const navigation = [
  { name: "Oversikt", icon: House },
  { name: "Økonomi", icon: Wallet },
  { name: "Mat og kalorier", icon: Utensils },
  { name: "Aktivitet", icon: Footprints },
  { name: "Historikk", icon: History },
  { name: "Innstillinger", icon: Settings },
] as const;
type View = (typeof navigation)[number]["name"];
type Overlay =
  | { kind: "transaction"; entry?: Transaction; type?: Transaction["type"] }
  | { kind: "budget" | "activity" | "goals" | "manual" }
  | { kind: "food"; food: Food; entry?: FoodLog; saveOnly?: boolean }
  | { kind: "recipe"; recipe?: Meal }
  | { kind: "logRecipe"; recipe: Meal }
  | {
      kind: "delete";
      entity: "transactions" | "logs";
      id: string;
      name: string;
    };
export default function Tracker() {
  const [state, setState] = useState<State>(emptyState());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("Oversikt");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [offline, setOffline] = useState(false);
  const [initialScan, setInitialScan] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const saving = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    let active = true;
    const keyMode = () => {
      document.documentElement.dataset.input = "keyboard";
    };
    const pointerMode = () => {
      document.documentElement.dataset.input = "pointer";
    };
    window.addEventListener("keydown", keyMode);
    window.addEventListener("pointerdown", pointerMode);
    readState()
      .then((s) => {
        if (active) {
          setState(s);
          setReady(true);
        }
      })
      .catch((e) => setError(e.message));
    const refresh = () =>
      readState()
        .then((s) => {
          if (active) setState(s);
        })
        .catch((e) => setError(e.message));
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("noah-tracker");
      channel.current.onmessage = refresh;
    }
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("focus", refresh);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((r) =>
          r.active?.postMessage({
            type: "CACHE_SHELL_ASSETS",
            urls: performance.getEntriesByType("resource").map((x) => x.name),
          }),
        )
        .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("keydown", keyMode);
      window.removeEventListener("pointerdown", pointerMode);
      channel.current?.close();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const latestState = useRef(state);
  latestState.current = state;
  useEffect(
    () => (ready ? registerTrackerTools(() => latestState.current) : undefined),
    [ready],
  );
  const save: Save = async (change, message = "Endringene er lagret") => {
    if (!ready || saving.current) return false;
    saving.current = true;
    try {
      const next = await updateState(change);
      setState(next);
      setError("");
      channel.current?.postMessage("changed");
      toast.success(message);
      return true;
    } catch (e) {
      const message =
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Kunne ikke lagre. Kontroller verdiene og prøv igjen.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      saving.current = false;
    }
  };
  function open(o: Overlay) {
    if (!ready) return;
    trigger.current = document.activeElement as HTMLElement;
    setOverlay(o);
  }
  function close() {
    setOverlay(null);
  }
  function navigate(v: View, scan = false) {
    setView(v);
    setInitialScan(scan);
    setOverlay(null);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus());
  }
  const f = finances(state, month);
  const activity = state.activity.find((x) => x.date === date);
  const goal = goalAt(state, date);
  const calories = dailyCalories(state, date);
  const b = f.budget;
  const foodCategory = state.categories.find((c) => c.id === "cat-0");
  const foodBudget = foodCategory ? b?.categories[foodCategory.id] : undefined;
  const foodSpent = netSpent(
    f.tx.filter((x) => x.categoryId === foodCategory?.id),
  );
  const hasFoodBudget = foodBudget !== undefined;
  const selectedRemaining = hasFoodBudget
    ? foodBudget - foodSpent
    : f.remaining;
  const add = () => open({ kind: "transaction" });
  const edit = (entry: Transaction) => open({ kind: "transaction", entry });
  const remove = (t: Transaction) =>
    open({
      kind: "delete",
      entity: "transactions",
      id: t.id,
      name: t.title || money(t.amount),
    });
  const pick = (food: Food) =>
    open({
      kind: "food",
      food: state.foods.find((x) => x.id === food.id) ?? food,
    });
  const editFood = (entry: FoodLog) =>
    open({ kind: "food", food: entry.food, entry });
  const removeFood = (e: FoodLog) =>
    open({ kind: "delete", entity: "logs", id: e.id, name: e.food.name });
  const goalForm = () => open({ kind: "goals" });
  const titles: Record<View, [string, string]> = {
    Oversikt: [
      `Hei, ${state.settings.name}`,
      "En liten oversikt. Litt mer ro i hverdagen.",
    ],
    Økonomi: ["Pengene dine", "Små kjøp, store planer. Hold oversikten her."],
    "Mat og kalorier": [
      "Mat og kalorier",
      "Finn maten. Velg mengden. Resten regner vi ut.",
    ],
    Aktivitet: ["I ditt eget tempo", "Skrittene dine, én dag av gangen."],
    Historikk: ["Tilbakeblikk", "Finn en dag. Se hele bildet."],
    Innstillinger: [
      "Gjør den til din",
      "Dine mål, dine innstillinger og dine data.",
    ],
  };
  return (
    <>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: "tracker-toast" }}
      />
      <SidebarProvider className="app-shell">
        <Sidebar collapsible="none" className="sidebar">
          <a className="brand" href="/" aria-label="Noah Tracker, oversikt">
            <span className="brand-mark">
              n<span>·</span>
            </span>
            <span>
              noah<span className="brand-sub">Din hverdag, samlet.</span>
            </span>
          </a>
          <nav aria-label="Hovedmeny">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                disabled={!ready}
                key={name}
                aria-label={name}
                aria-current={view === name ? "page" : undefined}
                className={view === name ? "nav-item active" : "nav-item"}
                onClick={() => navigate(name)}
              >
                <Icon size={19} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <ShieldCheck size={18} />
            <span>
              Bare på din enhet<small>Husk en sikkerhetskopi</small>
            </span>
          </div>
        </Sidebar>
        <div className="workspace">
          <header className="topbar">
            <span>
              <span className="brand-mobile">
                noah<span>·</span>
              </span>
              <span className="desktop-label">Din personlige oversikt</span>
            </span>
            <div className="topbar-end">
              {offline ? (
                <span className="offline-label">
                  <WifiOff size={14} />
                  Uten nett
                </span>
              ) : (
                <span className="storage-label">
                  <span />
                  Lokalt lagret
                </span>
              )}
              <button
                className="avatar"
                aria-label="Åpne innstillinger"
                onClick={() => navigate("Innstillinger")}
              >
                {state.settings.name.slice(0, 1).toUpperCase()}
              </button>
            </div>
          </header>
          <main id="main">
            <div className="page-heading">
              <div>
                <h1 ref={heading} tabIndex={-1}>
                  {titles[view][0]}
                  <span className="accent">.</span>
                </h1>
                <p>{titles[view][1]}</p>
              </div>
              {view === "Oversikt" && (
                <DatePicker value={month} onChange={setMonth} month />
              )}
            </div>
            {error && (
              <div role="alert" className="error-box">
                {error}
                <button className="text-button" onClick={() => setError("")}>
                  Lukk meldingen
                </button>
              </div>
            )}
            {!ready ? (
              <div className="loading-state" role="status">
                {error
                  ? "Lagring er utilgjengelig. Data blir ikke overskrevet."
                  : "Åpner din lokale oversikt …"}
              </div>
            ) : (
              <>
                {view === "Oversikt" && (
                  <>
                    {!state.settings.setup && (
                      <div className="welcome-strip">
                        <div>
                          <strong>Start med det som passer deg.</strong>
                          <span>
                            Sett dine egne mål nå, eller begynn å registrere.
                          </span>
                        </div>
                        <div className="actions">
                          <button className="text-button" onClick={goalForm}>
                            Sett mål <ArrowRight size={15} />
                          </button>
                          <button
                            className="icon-button quiet"
                            aria-label="Hopp over oppsett"
                            onClick={() =>
                              save((s) => {
                                s.settings.setup = true;
                              }, "Du kan sette mål i innstillinger senere")
                            }
                          >
                            <X size={17} />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="overview-grid">
                      <section className="panel money-panel">
                        <div className="section-head">
                          <h2>Pengene dine</h2>
                          <button
                            aria-label="Åpne økonomi"
                            className="icon-button quiet"
                            onClick={() => navigate("Økonomi")}
                          >
                            <ArrowUpRight size={19} />
                          </button>
                        </div>
                        <div className="money-intro">
                          <span>
                            Utgifter i {monthLabel(month).split(" ")[0]}
                          </span>
                          <strong>{money(f.spent)}</strong>
                          <div className="inline-money">
                            <span>
                              Inntekt <b>{money(f.income)}</b>
                            </span>
                            <span>
                              Registrert saldo{" "}
                              <b>
                                {balance(state) === null
                                  ? "Ikke satt"
                                  : money(balance(state)!)}
                              </b>
                            </span>
                          </div>
                        </div>
                        {hasFoodBudget || b?.total != null ? (
                          <div className="budget-preview">
                            <div className="row-between">
                              <span>
                                {hasFoodBudget
                                  ? foodCategory?.name
                                  : "Totalbudsjett"}
                              </span>
                              <button
                                className="text-button"
                                onClick={() => open({ kind: "budget" })}
                              >
                                Endre
                              </button>
                            </div>
                            <div className="budget-remaining">
                              <strong
                                className={
                                  selectedRemaining !== null &&
                                  selectedRemaining < 0
                                    ? "negative"
                                    : ""
                                }
                              >
                                {money(Math.abs(selectedRemaining ?? 0))}
                              </strong>
                              <span>
                                {selectedRemaining !== null &&
                                selectedRemaining < 0
                                  ? "over budsjett"
                                  : "igjen av budsjettet"}
                              </span>
                            </div>
                            <Progress
                              value={
                                (hasFoodBudget ? foodBudget! : b!.total!) === 0
                                  ? (hasFoodBudget ? foodSpent : f.spent) > 0
                                    ? 100
                                    : 0
                                  : ((hasFoodBudget ? foodSpent : f.spent) /
                                      (hasFoodBudget
                                        ? foodBudget!
                                        : b!.total!)) *
                                    100
                              }
                              label="Budsjett brukt"
                            />
                            <div className="row-between subtle">
                              <span>
                                {money(hasFoodBudget ? foodSpent : f.spent)}{" "}
                                brukt
                              </span>
                              <span>
                                av{" "}
                                {money(hasFoodBudget ? foodBudget! : b!.total!)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="budget-empty"
                            onClick={() => open({ kind: "budget" })}
                          >
                            <span className="soft-icon">
                              <Wallet size={22} />
                            </span>
                            <span>
                              <strong>Gi måneden en ramme</strong>
                              <small>
                                Sett et budsjett og se hva du har igjen.
                              </small>
                            </span>
                            <ChevronRight size={18} />
                          </button>
                        )}
                        <div className="money-actions">
                          <Btn onClick={add}>
                            <Plus size={18} />
                            Legg til utgift
                          </Btn>
                          <button
                            className="text-button"
                            onClick={() =>
                              open({ kind: "transaction", type: "income" })
                            }
                          >
                            Legg til inntekt
                          </button>
                        </div>
                      </section>
                      <section className="daily-panel panel">
                        <div className="section-head">
                          <h2>Dagen din</h2>
                          <DatePicker value={date} onChange={setDate} />
                        </div>
                        <div className="daily-stat">
                          <span className="soft-icon blue">
                            <Footprints />
                          </span>
                          <div>
                            <span>Skritt</span>
                            <strong>
                              {activity?.steps == null
                                ? "—"
                                : num(activity.steps)}
                            </strong>
                            <small>
                              {goal?.steps
                                ? `av ${num(goal.steps)} skritt`
                                : activity?.steps == null
                                  ? "Ingen skritt registrert"
                                  : "Mål ikke satt"}
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label="Oppdater skritt"
                            onClick={() => open({ kind: "activity" })}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <div className="daily-stat">
                          <span className="soft-icon peach">
                            <Utensils />
                          </span>
                          <div>
                            <span>Kalorier</span>
                            <strong>
                              {calories === null ? "—" : num(calories)}
                              <em> kcal</em>
                            </strong>
                            <small>
                              {goal?.calories
                                ? `Ditt mål: ${num(goal.calories)} kcal`
                                : "Målet bestemmer du selv"}
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label="Logg mat"
                            onClick={() => navigate("Mat og kalorier")}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <Btn
                          secondary
                          className="wide"
                          onClick={() => navigate("Mat og kalorier")}
                        >
                          <SearchIcon />
                          Søk etter mat
                          <ArrowRight size={16} />
                        </Btn>
                        <button
                          className="text-button scan-shortcut"
                          onClick={() => navigate("Mat og kalorier", true)}
                        >
                          <ScanLine size={15} />
                          Skann en strekkode
                        </button>
                      </section>
                    </div>
                    <section className="recent-section">
                      <div className="section-head">
                        <h2>Siste registreringer</h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("Historikk")}
                        >
                          Se historikk <ArrowRight size={15} />
                        </button>
                      </div>
                      {state.transactions.length ||
                      state.logs.length ||
                      state.activity.length ? (
                        <>
                          <TransactionList
                            state={state}
                            entries={[...state.transactions]
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .slice(0, 4)}
                            edit={edit}
                            remove={remove}
                          />
                          {[...state.logs]
                            .reverse()
                            .slice(0, 2)
                            .map((l) => (
                              <button
                                className="record full-record"
                                key={l.id}
                                onClick={() => {
                                  setDate(l.date);
                                  navigate("Mat og kalorier");
                                }}
                              >
                                <span className="record-icon peach">
                                  <Utensils size={17} />
                                </span>
                                <span className="record-text">
                                  <strong>{l.food.name}</strong>
                                  <small>{dateLabel(l.date)} · Mat</small>
                                </span>
                                <strong>{num(l.kcal)} kcal</strong>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                          {[...state.activity]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .slice(0, 2)
                            .map((a) => (
                              <button
                                className="record full-record"
                                key={a.date}
                                onClick={() => {
                                  setDate(a.date);
                                  navigate("Aktivitet");
                                }}
                              >
                                <span className="record-icon blue">
                                  <Footprints size={17} />
                                </span>
                                <span className="record-text">
                                  <strong>
                                    {a.steps == null
                                      ? "Dagens notat"
                                      : `${num(a.steps)} skritt`}
                                  </strong>
                                  <small>{dateLabel(a.date)} · Aktivitet</small>
                                </span>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                        </>
                      ) : (
                        <Empty
                          title="Her begynner historien din"
                          icon={<History size={26} />}
                        >
                          Utgifter, måltider og aktivitet dukker opp her
                          <br />
                          etter hvert som du registrerer dem.
                        </Empty>
                      )}
                    </section>
                  </>
                )}
                {view === "Økonomi" && (
                  <MoneyPage
                    state={state}
                    month={month}
                    setMonth={setMonth}
                    add={add}
                    edit={edit}
                    remove={remove}
                    budget={() => open({ kind: "budget" })}
                  />
                )}
                {view === "Mat og kalorier" && (
                  <FoodPage
                    state={state}
                    date={date}
                    setDate={setDate}
                    save={save}
                    pick={pick}
                    custom={() =>
                      open({
                        kind: "food",
                        food: foodSchema.parse({
                          id: `custom:${id()}`,
                          name: "Nytt produkt",
                          source: "Egen registrering",
                          kcal100: null,
                          unit: null,
                        }),
                        saveOnly: true,
                      })
                    }
                    edit={editFood}
                    remove={removeFood}
                    manual={() => open({ kind: "manual" })}
                    recipe={(recipe) => open({ kind: "recipe", recipe })}
                    logRecipe={(recipe) => open({ kind: "logRecipe", recipe })}
                    initialScan={initialScan}
                  />
                )}
                {view === "Aktivitet" && (
                  <ActivityPage
                    state={state}
                    date={date}
                    setDate={setDate}
                    edit={() => open({ kind: "activity" })}
                    goals={goalForm}
                  />
                )}
                {view === "Historikk" && (
                  <>
                    <div className="page-toolbar">
                      <DatePicker value={date} onChange={setDate} />
                      <button
                        className="text-button"
                        onClick={() => setDate(today())}
                      >
                        Til i dag
                      </button>
                    </div>
                    <div className="week-strip">
                      {weekDates(date).map((d) => (
                        <button
                          key={d}
                          className={d === date ? "selected" : ""}
                          onClick={() => setDate(d)}
                        >
                          <span>{dateLabel(d, { weekday: "short" })}</span>
                          <strong>{Number(d.slice(8))}</strong>
                          <i
                            className={
                              state.transactions.some((t) => t.date === d) ||
                              state.logs.some((t) => t.date === d) ||
                              state.activity.some((t) => t.date === d)
                                ? "has-data"
                                : ""
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <div className="history-summary">
                      <span>
                        <Footprints size={18} />
                        {activity?.steps == null
                          ? "Ingen skritt ført"
                          : `${num(activity.steps)} skritt`}
                      </span>
                      <span>
                        <Utensils size={18} />
                        {calories === null
                          ? "Ingen kalorier ført"
                          : `${num(calories)} kcal`}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => open({ kind: "activity" })}
                      >
                        Oppdater dagen
                      </button>
                    </div>
                    <div className="history-grid">
                      <section className="panel">
                        <div className="section-head">
                          <h2>Økonomi</h2>
                          <button className="text-button" onClick={add}>
                            <Plus size={16} />
                            Legg til
                          </button>
                        </div>
                        <TransactionList
                          state={state}
                          entries={state.transactions.filter(
                            (x) => x.date === date,
                          )}
                          edit={edit}
                          remove={remove}
                        />
                      </section>
                      <section className="panel">
                        <div className="section-head">
                          <h2>Mat og drikke</h2>
                          <button
                            className="text-button"
                            onClick={() => navigate("Mat og kalorier")}
                          >
                            <Plus size={16} />
                            Logg mat
                          </button>
                        </div>
                        <FoodLogs
                          state={state}
                          date={date}
                          edit={editFood}
                          remove={removeFood}
                        />
                      </section>
                    </div>
                    {activity?.note && (
                      <section className="panel note-panel">
                        <h2>Dagens notat</h2>
                        <p>{activity.note}</p>
                      </section>
                    )}
                  </>
                )}
                {view === "Innstillinger" && (
                  <SettingsPage state={state} save={save} goals={goalForm} />
                )}
              </>
            )}
            <footer>
              <span>
                <ShieldCheck size={12} />
                Lagres i denne nettleseren
              </span>
              <span>Din hverdag. Ditt tempo.</span>
            </footer>
          </main>
        </div>
      </SidebarProvider>
      {overlay && (
        <Modal
          title={
            overlay.kind === "transaction"
              ? overlay.entry
                ? "Rediger registrering"
                : overlay.type === "income"
                  ? "Legg til inntekt"
                  : "Ny registrering"
              : overlay.kind === "budget"
                ? `Budsjett · ${monthLabel(month)}`
                : overlay.kind === "activity"
                  ? "Oppdater dagen"
                  : overlay.kind === "goals"
                    ? "Dine mål"
                    : overlay.kind === "food"
                      ? overlay.saveOnly
                        ? "Lagre eget produkt"
                        : "Mengde og kalorier"
                      : overlay.kind === "manual"
                        ? "Dagens kaloriføring"
                        : overlay.kind === "recipe"
                          ? "Ditt måltid"
                          : overlay.kind === "logRecipe"
                            ? overlay.recipe.name
                            : "Slett registrering?"
          }
          onClose={close}
          trigger={trigger.current}
        >
          {overlay.kind === "transaction" && (
            <TransactionForm
              state={state}
              entry={overlay.entry}
              kind={overlay.type}
              date={date}
              save={save}
              close={close}
            />
          )}{" "}
          {overlay.kind === "budget" && (
            <BudgetForm state={state} month={month} save={save} close={close} />
          )}{" "}
          {overlay.kind === "activity" && (
            <ActivityForm state={state} date={date} save={save} close={close} />
          )}{" "}
          {overlay.kind === "goals" && (
            <GoalsForm state={state} date={date} save={save} close={close} />
          )}{" "}
          {overlay.kind === "food" && overlay.entry?.food.source === "Lagret måltid" && <MealEntryForm entry={overlay.entry} save={save} close={close}/>}
          {overlay.kind === "food" && overlay.entry?.food.source !== "Lagret måltid" && (
            <FoodForm
              food={overlay.food}
              entry={overlay.entry}
              date={date}
              save={save}
              close={close}
              saveOnly={overlay.saveOnly}
            />
          )}{" "}
          {overlay.kind === "manual" && (
            <ManualCalories
              state={state}
              date={date}
              save={save}
              close={close}
            />
          )}{" "}
          {overlay.kind === "recipe" && (
            <RecipeForm
              state={state}
              recipe={overlay.recipe}
              save={save}
              close={close}
            />
          )}{" "}
          {overlay.kind === "logRecipe" && (
            <LogRecipe
              recipe={overlay.recipe}
              date={date}
              save={save}
              close={close}
            />
          )}{" "}
          {overlay.kind === "delete" && (
            <Form
              label="Slett registrering"
              cancel={close}
              onSubmit={async () => {
                if (
                  await save((s) => {
                    if (overlay.entity === "transactions")
                      s.transactions = s.transactions.filter(
                        (x) => x.id !== overlay.id,
                      );
                    else s.logs = s.logs.filter((x) => x.id !== overlay.id);
                  }, "Registreringen er slettet")
                )
                  close();
              }}
            >
              <p className="notice">
                Vil du slette «{overlay.name}»? Alle berørte totaler blir
                oppdatert.
              </p>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
function SearchIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  );
}
