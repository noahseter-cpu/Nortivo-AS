"use client";
import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Pencil,
  Trash2,
  Wallet,
  Search,
} from "lucide-react";
import {
  type State,
  type Transaction,
  amountOre,
  finances,
  money,
  netSpent,
  allowance,
  monthLabel,
  shiftMonth,
  put,
  id,
  dateLabel,
  today,
  balance,
} from "@/lib/tracker-core";
import {
  Btn,
  Empty,
  Field,
  Form,
  DatePicker,
  Progress,
  val,
  optional,
  type Save,
} from "./tracker-shared";
export function TransactionForm({
  state,
  entry,
  date,
  kind = "expense",
  save,
  close,
}: {
  state: State;
  entry?: Transaction;
  date: string;
  kind?: Transaction["type"];
  save: Save;
  close: () => void;
}) {
  const [type, setType] = useState(entry?.type ?? kind);
  return (
    <Form
      cancel={close}
      onSubmit={async (d) => {
        const tx: Transaction = {
          id: entry?.id ?? id(),
          type,
          amount: amountOre(val(d, "amount")),
          categoryId: val(d, "category"),
          date: val(d, "date"),
          title: val(d, "title"),
          note: val(d, "note"),
        };
        if (tx.amount <= 0) throw Error("Beløpet må være større enn null.");
        if (
          await save(
            (s) => put(s.transactions, tx),
            entry ? "Registreringen er oppdatert" : "Registreringen er lagret",
          )
        )
          close();
      }}
    >
      <Field label="Type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Transaction["type"])}
        >
          <option value="expense">Utgift</option>
          <option value="income">Inntekt</option>
          <option value="refund">Refusjon</option>
        </select>
      </Field>
      <Field label="Beløp i kroner">
        <input
          name="amount"
          autoFocus
          inputMode="decimal"
          required
          placeholder="0,00"
          defaultValue={
            entry ? (entry.amount / 100).toString().replace(".", ",") : ""
          }
          className="amount-input"
        />
      </Field>
      <div className="form-row">
        <Field label="Kategori">
          <select
            name="category"
            defaultValue={
              entry?.categoryId ?? state.categories.find((x) => !x.archived)?.id
            }
          >
            {state.categories
              .filter((x) => !x.archived || x.id === entry?.categoryId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.archived ? " (arkivert)" : ""}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Dato">
          <input
            type="date"
            name="date"
            required
            defaultValue={entry?.date ?? date}
          />
        </Field>
      </div>
      <Field
        label={
          type === "income"
            ? "Tittel (valgfritt)"
            : "Butikk eller tittel (valgfritt)"
        }
      >
        <input
          name="title"
          maxLength={150}
          placeholder={
            type === "income" ? "For eksempel lønn" : "For eksempel dagligvarer"
          }
          defaultValue={entry?.title}
        />
      </Field>
      <Field label="Notat (valgfritt)">
        <textarea
          name="note"
          maxLength={1000}
          rows={2}
          defaultValue={entry?.note}
        />
      </Field>
      {type === "refund" && (
        <p className="help">
          En refusjon reduserer forbruket i kategorien på refusjonsdatoen og
          øker registrert saldo. Den regnes ikke som inntekt.
        </p>
      )}
    </Form>
  );
}
export function BudgetForm({
  state,
  month,
  save,
  close,
}: {
  state: State;
  month: string;
  save: Save;
  close: () => void;
}) {
  const current = state.budgets.find((x) => x.month === month);
  const [source, setSource] = useState(current);
  const [version, setVersion] = useState(0);
  return (
    <>
      <p className="help">
        Gjelder bare {monthLabel(month)}. Tomt felt betyr at grensen ikke er
        satt. 0 betyr ingen planlagt bruk. Kategorigrenser legges ikke til
        totalgrensen.
      </p>
      <button
        className="text-button"
        onClick={() => {
          const previous = state.budgets.find(
            (x) => x.month === shiftMonth(month, -1),
          );
          setSource(previous);
          setVersion((v) => v + 1);
        }}
      >
        Kopier forrige måneds grenser
      </button>
      <Form
        key={version}
        cancel={close}
        onSubmit={async (d) => {
          const categories: Record<string, number> = {};
          for (const c of state.categories) {
            const v = val(d, c.id);
            if (v !== "") categories[c.id] = amountOre(v);
          }
          if (
            await save(
              (s) =>
                put(
                  s.budgets,
                  { month, total: optional(d, "total", amountOre), categories },
                  "month",
                ),
              "Månedens budsjett er lagret",
            )
          )
            close();
        }}
      >
        <Field label="Samlet månedsgrense (kr)">
          <input
            name="total"
            inputMode="decimal"
            placeholder="Ikke satt"
            defaultValue={source?.total == null ? "" : source.total / 100}
          />
        </Field>
        {state.categories.map((c) => (
          <Field
            key={c.id}
            label={`${c.name}${c.archived ? " (arkivert)" : ""} (kr)`}
          >
            <input
              name={c.id}
              inputMode="decimal"
              placeholder={c.id === "cat-0" ? "Eksempel: 2 300" : "Ikke satt"}
              defaultValue={
                source?.categories[c.id] === undefined
                  ? ""
                  : source.categories[c.id] / 100
              }
            />
          </Field>
        ))}
      </Form>
    </>
  );
}
export function BudgetList({
  state,
  month,
  edit,
}: {
  state: State;
  month: string;
  edit: () => void;
}) {
  const f = finances(state, month);
  const limits = state.categories.filter(
    (c) => f.budget?.categories[c.id] !== undefined,
  );
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Budsjetter</h2>
        <button className="text-button" onClick={edit}>
          Endre grenser <Pencil size={13} />
        </button>
      </div>
      {limits.length === 0 ? (
        <Empty title="En ramme for måneden" icon={<Wallet size={24} />}>
          Sett for eksempel 2 300 kr til mat.
          <br />
          <button className="text-button" onClick={edit}>
            Sett opp budsjett <ArrowUpRight size={14} />
          </button>
        </Empty>
      ) : (
        limits.map((c) => {
          const limit = f.budget!.categories[c.id],
            spent = netSpent(f.tx.filter((x) => x.categoryId === c.id)),
            remaining = limit - spent;
          const percent =
            limit === 0 ? (spent > 0 ? 100 : 0) : (spent / limit) * 100;
          const perDay = allowance(remaining, month);
          const status =
            remaining < 0
              ? "Over budsjett"
              : percent >= state.settings.danger
                ? "Grensen er nådd"
                : percent >= state.settings.warning
                  ? "Nær grensen"
                  : "Innenfor grensen";
          return (
            <div key={c.id} className="budget-row">
              <div className="row-between">
                <strong>{c.name}</strong>
                <span className={remaining < 0 ? "negative" : ""}>
                  {money(Math.abs(remaining))}{" "}
                  {remaining < 0 ? "over" : "igjen"}
                </span>
              </div>
              <Progress value={percent} label={`${c.name}: ${status}`} />
              <div className="row-between subtle">
                <span>
                  {money(spent)} av {money(limit)}
                </span>
                <span>
                  {limit === 0 ? "Nullbudsjett" : `${Math.round(percent)} %`} ·{" "}
                  {status}
                </span>
              </div>
              {perDay !== null && (
                <p className="help">
                  Ca. {money(perDay)} per dag resten av måneden, inkludert i
                  dag.
                </p>
              )}
            </div>
          );
        })
      )}
      <p className="help">
        Dagsbeløp er en veiledning. Grenser varsler i appen, men stopper ikke
        kjøp.
      </p>
    </section>
  );
}
export function TransactionList({
  state,
  entries,
  edit,
  remove,
}: {
  state: State;
  entries: Transaction[];
  edit: (t: Transaction) => void;
  remove: (t: Transaction) => void;
}) {
  if (!entries.length)
    return (
      <Empty title="Ingen registreringer her ennå">
        Legg til en utgift, inntekt eller refusjon.
      </Empty>
    );
  return (
    <div className="record-list">
      {[...entries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => (
          <div className="record" key={t.id}>
            <span
              className={`record-icon ${t.type === "expense" ? "peach" : "blue"}`}
            >
              {t.type === "expense" ? (
                <ArrowUpRight size={18} />
              ) : t.type === "income" ? (
                <ArrowDownLeft size={18} />
              ) : (
                <RotateCcw size={18} />
              )}
            </span>
            <div className="record-text">
              <strong>
                {t.title ||
                  state.categories.find((c) => c.id === t.categoryId)?.name}
              </strong>
              <small>
                {state.categories.find((c) => c.id === t.categoryId)?.name} ·{" "}
                {dateLabel(t.date)} ·{" "}
                {
                  { expense: "Utgift", income: "Inntekt", refund: "Refusjon" }[
                    t.type
                  ]
                }
              </small>
              {t.note && <small>{t.note}</small>}
            </div>
            <strong className={t.type !== "expense" ? "positive" : ""}>
              {t.type === "expense" ? "−" : "+"}
              {money(t.amount)}
            </strong>
            <button
              className="icon-button quiet"
              aria-label={`Rediger ${t.title || "registrering"}`}
              onClick={() => edit(t)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button quiet"
              aria-label={`Slett ${t.title || "registrering"}`}
              onClick={() => remove(t)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
    </div>
  );
}
export function MoneyPage({
  state,
  month,
  setMonth,
  edit,
  add,
  budget,
  remove,
}: {
  state: State;
  month: string;
  setMonth: (m: string) => void;
  edit: (t: Transaction) => void;
  add: () => void;
  budget: () => void;
  remove: (t: Transaction) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const f = finances(state, month);
  const registered = balance(state, today());
  const rows = f.tx.filter(
    (t) =>
      (!category || t.categoryId === category) &&
      (!date || t.date === date) &&
      `${t.title} ${t.note}`
        .toLocaleLowerCase("nb")
        .includes(query.toLocaleLowerCase("nb")),
  );
  return (
    <>
      <div className="page-toolbar">
        <DatePicker value={month} onChange={setMonth} month />
        <Btn onClick={add}>
          <Plus size={17} />
          Legg til registrering
        </Btn>
      </div>
      <div className="money-summary">
        <div>
          <span>Utgifter etter refusjoner</span>
          <strong>{money(f.spent)}</strong>
        </div>
        <div>
          <span>Inntekter</span>
          <strong>{money(f.income)}</strong>
        </div>
        <div>
          <span>Igjen av totalbudsjett</span>
          <strong
            className={
              f.remaining !== null && f.remaining < 0 ? "negative" : ""
            }
          >
            {f.remaining === null ? "Ikke satt" : money(f.remaining)}
          </strong>
        </div>
        <div>
          <span>Registrert saldo · i dag</span>
          <strong>
            {registered === null ? "Ikke satt" : money(registered)}
          </strong>
        </div>
      </div>
      {f.budget?.total!=null && <p className={f.remaining!==null&&f.remaining<0?"notice negative":"help section-note"}>
        {f.remaining!==null&&f.remaining<0?`${money(-f.remaining)} over totalbudsjettet.`:f.spent>=(f.budget.total*state.settings.danger/100)?"Totalgrensen er nådd.":f.spent>=(f.budget.total*state.settings.warning/100)?"Du nærmer deg totalgrensen.":"Innenfor totalgrensen."}
        {allowance(f.remaining,month)!==null?` Veiledning: ${money(allowance(f.remaining,month)!)} per dag resten av måneden, inkludert i dag.`:""}
      </p>}
      <div className="finance-grid">
        <BudgetList state={state} month={month} edit={budget} />
        <section className="panel">
          <div className="section-head">
            <h2>Registreringer</h2>
            <span className="subtle">{rows.length} treff</span>
          </div>
          <div className="filters">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Søk i transaksjoner"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søk etter butikk eller notat"
              />
            </label>
            <select
              aria-label="Filtrer kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Alle kategorier</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Filtrer dato"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {(query || category || date) && (
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setDate("");
                }}
              >
                Nullstill filtre
              </button>
            )}
          </div>
          <TransactionList
            state={state}
            entries={rows}
            edit={edit}
            remove={remove}
          />
        </section>
      </div>
      <p className="help section-note">
        Registrert saldo bygger bare på det du har ført, og er ikke en
        banksaldo. Utgifter uten kategoribudsjett er også med i totalen.
      </p>
    </>
  );
}
