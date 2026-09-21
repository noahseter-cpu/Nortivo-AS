"use client";
import { t as tr, useI18n, errorMessage } from "@/lib/i18n";
import { initializeLanguage, syncLanguage, getLanguage } from "@/lib/language";
import { preferredFood, localizedFoodName } from "@/lib/food-adapters";
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
  Moon,
  Sun,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
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
  categoryLabel,
  id,
  foodSchema,
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
import { SettingsPage, GoalsForm, LanguagePicker } from "./tracker-settings";
import { ProfileSetup } from "./tracker-profile";
import { applyAppearance } from "@/lib/appearance";
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
  useI18n();
  const [state, setState] = useState<State>(emptyState());
  const [ready, setReady] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [darkAppearance, setDarkAppearance] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("Oversikt");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [offline, setOffline] = useState(false);
  const [initialScan, setInitialScan] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
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
      .then(initializeLanguage)
      .then((s) => {
        if (active) {
          setState(s);
          setReady(true);
        }
      })
      .catch((e) => setError(errorMessage(e)));
    const refresh = () =>
      readState()
        .then((s) => {
          if (active) {
            syncLanguage(s);
            setState(s);
          }
        })
        .catch((e) => setError(errorMessage(e)));
    const languageCommitted = (e: Event) => {
      if (active) {
        setState((e as CustomEvent<State>).detail);
        channel.current?.postMessage("changed");
      }
    };
    window.addEventListener("arc-language-committed", languageCommitted);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("noah-tracker");
      channel.current.onmessage = refresh;
    }
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("focus", refresh);
    if (
      process.env.NEXT_PUBLIC_ANDROID !== "true" &&
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    )
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
      window.removeEventListener("arc-language-committed", languageCommitted);
    };
  }, []);
  const latestState = useRef(state);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        state.settings.theme === "dark" ||
        (state.settings.theme === "system" && media.matches);
      applyAppearance(dark);
      setDarkAppearance(dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state.settings.theme]);
  useEffect(() => {
    const back = () => {
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          }),
        );
        return;
      }
      if (editProfile) {
        setEditProfile(false);
        return;
      }
      if (view !== "Oversikt") {
        setView("Oversikt");
        return;
      }
      void import("@capacitor/app").then(({ App }) => App.minimizeApp());
    };
    window.addEventListener("noah-back", back);
    return () => window.removeEventListener("noah-back", back);
  }, [editProfile, view]);
  useEffect(() => {
    latestState.current = state;
  }, [state]);
  useEffect(
    () => (ready ? registerTrackerTools(() => latestState.current) : undefined),
    [ready],
  );
  const save: Save = async (change, message = tr("Endringene er lagret")) => {
    if (!ready || saving.current) return false;
    saving.current = true;
    try {
      const next = await updateState(change);
      syncLanguage(next);
      setState(next);
      setError("");
      channel.current?.postMessage("changed");
      toast.success(message);
      return true;
    } catch (e) {
      const message = errorMessage(
        e,
        "Kunne ikke lagre. Kontroller verdiene og prøv igjen.",
      );
      setError(message);
      toast.error(message);
      return false;
    } finally {
      saving.current = false;
    }
  };
  function open(o: Overlay) {
    if (!ready) return;
    setTrigger(document.activeElement as HTMLElement);
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
      food: preferredFood(food, state.foods),
    });
  const editFood = (entry: FoodLog) =>
    open({ kind: "food", food: entry.food, entry });
  const removeFood = (e: FoodLog) =>
    open({
      kind: "delete",
      entity: "logs",
      id: e.id,
      name: localizedFoodName(e.food, getLanguage()),
    });
  const goalForm = () => open({ kind: "goals" });
  const titles: Record<View, [string, string]> = {
    Oversikt: [
      state.settings.name
        ? tr("Hei, {name}", { name: state.settings.name })
        : tr("Hei"),
      tr("En liten oversikt. Litt mer ro i hverdagen."),
    ],
    Økonomi: [
      tr("Pengene dine"),
      tr("Små kjøp, store planer. Hold oversikten her."),
    ],
    "Mat og kalorier": [
      tr("Mat og kalorier"),
      tr("Finn maten. Velg mengden. Resten regner vi ut."),
    ],
    Aktivitet: [
      tr("I ditt eget tempo"),
      tr("Skrittene dine, én dag av gangen."),
    ],
    Historikk: [tr("Tilbakeblikk"), tr("Finn en dag. Se hele bildet.")],
    Innstillinger: [
      tr("Gjør den til din"),
      tr("Dine mål, dine innstillinger og dine data."),
    ],
  };
  if (!ready)
    return (
      <main className="startup-view">
        <img src="/arc-logo.svg" alt="Arc" width="64" height="64" />
        <LanguagePicker />
        {error && (
          <p role="alert" className="error-box">
            {errorMessage(new Error(error))}
          </p>
        )}
      </main>
    );
  if (
    ready &&
    (editProfile ||
      (process.env.NEXT_PUBLIC_ANDROID === "true" && !state.profilePromptSeen))
  )
    return (
      <>
        <Toaster
          position="top-center"
          richColors
          containerAriaLabel={tr("Varsler")}
        />
        <ProfileSetup
          state={state}
          save={save}
          close={() => setEditProfile(false)}
          first={!state.profilePromptSeen}
        />
      </>
    );
  return (
    <>
      <Toaster
        containerAriaLabel={tr("Varsler")}
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          className: "tracker-toast",
          closeButtonAriaLabel: tr("Lukk meldingen"),
        }}
      />
      <SidebarProvider className="app-shell">
        <a className="skip-link" href="#main">
          {tr("Hopp til innhold")}
        </a>
        <Sidebar collapsible="none" className="sidebar">
          <button
            className="brand"
            type="button"
            onClick={() => setView("Oversikt")}
            aria-label={tr("Arc by Nortivo, oversikt")}
          >
            <span className="arc-wordmark" aria-hidden="true" />
            <span className="brand-sub">by Nortivo</span>
          </button>
          <nav aria-label={tr("Hovedmeny")}>
            {navigation.map(({ name, icon: Icon }) => (
              <button
                disabled={!ready}
                key={name}
                aria-label={tr(name)}
                aria-current={view === name ? "page" : undefined}
                className={view === name ? "nav-item active" : "nav-item"}
                onClick={() => navigate(name)}
              >
                <Icon size={19} />
                <span>
                  {name === "Mat og kalorier" ? (
                    <>
                      <span className="nav-long">{tr(name)}</span>
                      <span className="nav-short">{tr("Mat")}</span>
                    </>
                  ) : (
                    tr(name)
                  )}
                </span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <ShieldCheck size={18} />
            <span>
              {tr("Bare på din enhet")}
              <small>{tr("Husk en sikkerhetskopi")}</small>
            </span>
          </div>
        </Sidebar>
        <div className="workspace">
          <header className="topbar">
            <span>
              <span
                className="brand-mobile"
                role="img"
                aria-label="Arc by Nortivo"
              >
                <span className="arc-wordmark" aria-hidden="true" />
              </span>
              <span className="desktop-label">
                {tr("Din personlige oversikt")}
              </span>
            </span>
            <div className="topbar-end">
              <button
                className="icon-button theme-toggle"
                aria-label={tr("Bytt lyst eller mørkt tema")}
                aria-pressed={darkAppearance}
                disabled={!ready}
                onClick={() =>
                  save((s) => {
                    s.settings.theme = darkAppearance ? "light" : "dark";
                  }, tr("Temaet er lagret"))
                }
              >
                {darkAppearance ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {offline ? (
                <span className="offline-label">
                  <WifiOff size={14} />
                  {tr("Uten nett")}
                </span>
              ) : (
                <span className="storage-label">
                  <span />
                  {tr("Lokalt lagret")}
                </span>
              )}
              <button
                className="avatar"
                aria-label={tr("Åpne innstillinger")}
                onClick={() => navigate("Innstillinger")}
              >
                {state.settings.name.slice(0, 1).toUpperCase() || "A"}
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
                {errorMessage(new Error(error))}
                <button className="text-button" onClick={() => setError("")}>
                  {tr("Lukk meldingen")}
                </button>
              </div>
            )}
            {!ready ? (
              <div className="loading-state" role="status">
                {error
                  ? tr("Lagring er utilgjengelig. Data blir ikke overskrevet.")
                  : tr("Åpner din lokale oversikt …")}
              </div>
            ) : (
              <>
                {view === "Oversikt" && (
                  <>
                    {!state.settings.setup && (
                      <div className="welcome-strip">
                        <div>
                          <strong>{tr("Start med det som passer deg.")}</strong>
                          <span>
                            {tr(
                              "Sett dine egne mål nå, eller begynn å registrere.",
                            )}
                          </span>
                        </div>
                        <div className="actions">
                          <LanguagePicker />
                          <button className="text-button" onClick={goalForm}>
                            {tr("Sett mål")}
                            <ArrowRight size={15} />
                          </button>
                          <button
                            className="icon-button quiet"
                            aria-label={tr("Hopp over oppsett")}
                            onClick={() =>
                              save((s) => {
                                s.settings.setup = true;
                              }, tr("Du kan sette mål i innstillinger senere"))
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
                          <h2>{tr("Pengene dine")}</h2>
                          <button
                            aria-label={tr("Åpne økonomi")}
                            className="icon-button quiet"
                            onClick={() => navigate("Økonomi")}
                          >
                            <ArrowUpRight size={19} />
                          </button>
                        </div>
                        <div className="money-intro">
                          <span>
                            {tr("Utgifter i {month}", {
                              month: dateLabel(month + "-01", {
                                month: "long",
                              }),
                            })}
                          </span>
                          <strong>{money(f.spent)}</strong>
                          <div className="inline-money">
                            <span>
                              {tr("Inntekt")}
                              <b>{money(f.income)}</b>
                            </span>
                            <span>
                              {tr("Registrert saldo")}{" "}
                              <b>
                                {balance(state) === null
                                  ? tr("Ikke satt")
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
                                  ? categoryLabel(foodCategory!)
                                  : tr("Totalbudsjett")}
                              </span>
                              <button
                                className="text-button"
                                onClick={() => open({ kind: "budget" })}
                              >
                                {tr("Endre")}
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
                                  ? tr("over budsjett")
                                  : tr("igjen av budsjettet")}
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
                              label={tr("Budsjett brukt")}
                            />
                            <div className="row-between subtle">
                              <span>
                                {tr("{amount} brukt", {
                                  amount: money(
                                    hasFoodBudget ? foodSpent : f.spent,
                                  ),
                                })}
                              </span>
                              <span>
                                {tr("av {amount}", {
                                  amount: money(
                                    hasFoodBudget ? foodBudget! : b!.total!,
                                  ),
                                })}
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
                              <strong>{tr("Gi måneden en ramme")}</strong>
                              <small>
                                {tr("Sett et budsjett og se hva du har igjen.")}
                              </small>
                            </span>
                            <ChevronRight size={18} />
                          </button>
                        )}
                        <div className="money-actions">
                          <Btn onClick={add}>
                            <Plus size={18} />
                            {tr("Legg til utgift")}
                          </Btn>
                          <button
                            className="text-button"
                            onClick={() =>
                              open({ kind: "transaction", type: "income" })
                            }
                          >
                            {tr("Legg til inntekt")}
                          </button>
                        </div>
                      </section>
                      <section className="daily-panel panel">
                        <div className="section-head">
                          <h2>{tr("Dagen din")}</h2>
                          <DatePicker value={date} onChange={setDate} />
                        </div>
                        <div className="daily-stat">
                          <span className="soft-icon blue">
                            <Footprints />
                          </span>
                          <div>
                            <span>{tr("Skritt")}</span>
                            <strong>
                              {activity?.steps == null
                                ? "—"
                                : num(activity.steps)}
                            </strong>
                            <small>
                              {goal?.steps
                                ? tr("av {count} skritt", {
                                    count: num(goal.steps),
                                  })
                                : activity?.steps == null
                                  ? tr("Ingen skritt registrert")
                                  : tr("Mål ikke satt")}
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={tr("Oppdater skritt")}
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
                            <span>{tr("Kalorier")}</span>
                            <strong>
                              {calories === null ? "—" : num(calories)}
                              <em> kcal</em>
                            </strong>
                            <small>
                              {goal?.calories
                                ? tr("Ditt mål: {amount} kcal", {
                                    amount: num(goal.calories),
                                  })
                                : tr("Målet bestemmer du selv")}
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={tr("Logg mat")}
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
                          {tr("Søk etter mat")}
                          <ArrowRight size={16} />
                        </Btn>
                        <button
                          className="text-button scan-shortcut"
                          onClick={() => navigate("Mat og kalorier", true)}
                        >
                          <ScanLine size={15} />
                          {tr("Skann en strekkode")}
                        </button>
                      </section>
                    </div>
                    <section className="recent-section">
                      <div className="section-head">
                        <h2>{tr("Siste registreringer")}</h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("Historikk")}
                        >
                          {tr("Se historikk")}
                          <ArrowRight size={15} />
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
                                  <strong>
                                    {localizedFoodName(l.food, getLanguage())}
                                  </strong>
                                  <small>
                                    {dateLabel(l.date)} · {tr("Mat")}
                                  </small>
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
                                      ? tr("Dagens notat")
                                      : tr("{count} skritt", {
                                          count: num(a.steps),
                                        })}
                                  </strong>
                                  <small>
                                    {dateLabel(a.date)} · {tr("Aktivitet")}
                                  </small>
                                </span>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                        </>
                      ) : (
                        <Empty
                          title={tr("Her begynner historien din")}
                          icon={<History size={26} />}
                        >
                          {tr(
                            "Utgifter, måltider og aktivitet dukker opp her etter hvert som du registrerer dem.",
                          )}
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
                          name: tr("Nytt produkt"),
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
                        {tr("Til i dag")}
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
                          ? tr("Ingen skritt ført")
                          : tr("{count} skritt", {
                              count: num(activity.steps),
                            })}
                      </span>
                      <span>
                        <Utensils size={18} />
                        {calories === null
                          ? tr("Ingen kalorier ført")
                          : `${num(calories)} kcal`}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => open({ kind: "activity" })}
                      >
                        {tr("Oppdater dagen")}
                      </button>
                    </div>
                    <div className="history-grid">
                      <section className="panel">
                        <div className="section-head">
                          <h2>{tr("Økonomi")}</h2>
                          <button className="text-button" onClick={add}>
                            <Plus size={16} />
                            {tr("Legg til")}
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
                          <h2>{tr("Mat og drikke")}</h2>
                          <button
                            className="text-button"
                            onClick={() => navigate("Mat og kalorier")}
                          >
                            <Plus size={16} />
                            {tr("Logg mat")}
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
                        <h2>{tr("Dagens notat")}</h2>
                        <p>{activity.note}</p>
                      </section>
                    )}
                  </>
                )}
                {view === "Innstillinger" && (
                  <SettingsPage
                    state={state}
                    save={save}
                    goals={goalForm}
                    profile={() => setEditProfile(true)}
                  />
                )}
              </>
            )}
            <footer>
              <span>
                <ShieldCheck size={12} />
                {tr("Lagres på denne enheten")}
              </span>
              <span>{tr("Din hverdag. Ditt tempo.")}</span>
            </footer>
          </main>
        </div>
      </SidebarProvider>
      {overlay && (
        <Modal
          title={
            overlay.kind === "transaction"
              ? overlay.entry
                ? tr("Rediger registrering")
                : overlay.type === "income"
                  ? tr("Legg til inntekt")
                  : tr("Ny registrering")
              : overlay.kind === "budget"
                ? tr("Budsjett · {month}", { month: monthLabel(month) })
                : overlay.kind === "activity"
                  ? tr("Oppdater dagen")
                  : overlay.kind === "goals"
                    ? tr("Dine mål")
                    : overlay.kind === "food"
                      ? overlay.saveOnly
                        ? tr("Lagre eget produkt")
                        : tr("Mengde og kalorier")
                      : overlay.kind === "manual"
                        ? tr("Dagens kaloriføring")
                        : overlay.kind === "recipe"
                          ? tr("Ditt måltid")
                          : overlay.kind === "logRecipe"
                            ? overlay.recipe.name
                            : tr("Slett registrering?")
          }
          onClose={close}
          trigger={trigger}
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
          {overlay.kind === "food" &&
            overlay.entry?.food.source === "Lagret måltid" && (
              <MealEntryForm entry={overlay.entry} save={save} close={close} />
            )}
          {overlay.kind === "food" &&
            overlay.entry?.food.source !== "Lagret måltid" && (
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
              label={tr("Slett registrering")}
              cancel={close}
              onSubmit={async () => {
                if (
                  await save((s) => {
                    if (overlay.entity === "transactions")
                      s.transactions = s.transactions.filter(
                        (x) => x.id !== overlay.id,
                      );
                    else s.logs = s.logs.filter((x) => x.id !== overlay.id);
                  }, tr("Registreringen er slettet"))
                )
                  close();
              }}
            >
              <p className="notice">
                {tr(
                  "Vil du slette «{name}»? Alle berørte totaler blir oppdatert.",
                  { name: overlay.name },
                )}
              </p>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
function SearchIcon() {
  useI18n();
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
