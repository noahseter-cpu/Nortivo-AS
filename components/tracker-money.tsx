"use client";
import { t as tr, useI18n } from "@/lib/i18n";
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
  inputNumber,
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
  categoryLabel,
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
  useI18n();
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
        if (tx.amount <= 0) throw Error(tr("Beløpet må være større enn null."));
        if (
          await save(
            (s) => put(s.transactions, tx),
            entry
              ? tr("Registreringen er oppdatert")
              : tr("Registreringen er lagret"),
          )
        )
          close();
      }}
    >
      <Field label={tr("Type")}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Transaction["type"])}
        >
          <option value="expense">{tr("Utgift")}</option>
          <option value="income">{tr("Inntekt")}</option>
          <option value="refund">{tr("Refusjon")}</option>
        </select>
      </Field>
      <Field label={tr("Beløp i kroner")}>
        <input
          name="amount"
          autoFocus
          inputMode="decimal"
          required
          placeholder={tr("0,00")}
          defaultValue={entry ? inputNumber(entry.amount / 100) : ""}
          className="amount-input"
        />
      </Field>
      <div className="form-row">
        <Field label={tr("Kategori")}>
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
                  {categoryLabel(x)}
                  {x.archived ? tr(" (arkivert)") : ""}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tr("Dato")}>
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
            ? tr("Tittel (valgfritt)")
            : tr("Butikk eller tittel (valgfritt)")
        }
      >
        <input
          name="title"
          maxLength={150}
          placeholder={
            type === "income"
              ? tr("For eksempel lønn")
              : tr("For eksempel dagligvarer")
          }
          defaultValue={entry?.title}
        />
      </Field>
      <Field label={tr("Notat (valgfritt)")}>
        <textarea
          name="note"
          maxLength={1000}
          rows={2}
          defaultValue={entry?.note}
        />
      </Field>
      {type === "refund" && (
        <p className="help">
          {tr(
            "En refusjon reduserer forbruket i kategorien på refusjonsdatoen og øker registrert saldo. Den regnes ikke som inntekt.",
          )}
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
  useI18n();
  const current = state.budgets.find((x) => x.month === month);
  const [source, setSource] = useState(current);
  const [version, setVersion] = useState(0);
  return (
    <>
      <p className="help">
        {tr(
          "Gjelder bare {month}. Tomt felt betyr at grensen ikke er satt. 0 betyr ingen planlagt bruk. Kategorigrenser legges ikke til totalgrensen.",
          { month: monthLabel(month) },
        )}
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
        {tr("Kopier forrige måneds grenser")}
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
              tr("Månedens budsjett er lagret"),
            )
          )
            close();
        }}
      >
        <Field label={tr("Samlet månedsgrense (kr)")}>
          <input
            name="total"
            inputMode="decimal"
            placeholder={tr("Ikke satt")}
            defaultValue={
              source?.total == null ? "" : inputNumber(source.total / 100)
            }
          />
        </Field>
        {state.categories.map((c) => (
          <Field
            key={c.id}
            label={`${categoryLabel(c)}${c.archived ? tr(" (arkivert)") : ""} (kr)`}
          >
            <input
              name={c.id}
              inputMode="decimal"
              placeholder={
                c.id === "cat-0" ? tr("Eksempel: 2 300") : tr("Ikke satt")
              }
              defaultValue={
                source?.categories[c.id] === undefined
                  ? ""
                  : inputNumber(source.categories[c.id] / 100)
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
  useI18n();
  const f = finances(state, month);
  const limits = state.categories.filter(
    (c) => f.budget?.categories[c.id] !== undefined,
  );
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tr("Budsjetter")}</h2>
        <button className="text-button" onClick={edit}>
          {tr("Endre grenser")}
          <Pencil size={13} />
        </button>
      </div>
      {limits.length === 0 ? (
        <Empty title={tr("En ramme for måneden")} icon={<Wallet size={24} />}>
          {tr("Sett for eksempel 2 300 kr til mat.")}
          <br />
          <button className="text-button" onClick={edit}>
            {tr("Sett opp budsjett")}
            <ArrowUpRight size={14} />
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
              ? tr("Over budsjett")
              : percent >= state.settings.danger
                ? tr("Grensen er nådd")
                : percent >= state.settings.warning
                  ? tr("Nær grensen")
                  : tr("Innenfor grensen");
          return (
            <div key={c.id} className="budget-row">
              <div className="row-between">
                <strong>{categoryLabel(c)}</strong>
                <span className={remaining < 0 ? "negative" : ""}>
                  {remaining < 0
                    ? tr("{amount} over", { amount: money(-remaining) })
                    : tr("{amount} igjen", { amount: money(remaining) })}
                </span>
              </div>
              <Progress
                value={percent}
                label={`${categoryLabel(c)}: ${status}`}
              />
              <div className="row-between subtle">
                <span>
                  {tr("{spent} av {limit}", {
                    spent: money(spent),
                    limit: money(limit),
                  })}
                </span>
                <span>
                  {limit === 0
                    ? tr("Nullbudsjett")
                    : `${Math.round(percent)} %`}{" "}
                  · {status}
                </span>
              </div>
              {perDay !== null && (
                <p className="help">
                  {tr(
                    "Ca. {amount} per dag resten av måneden, inkludert i dag.",
                    { amount: money(perDay) },
                  )}
                </p>
              )}
            </div>
          );
        })
      )}
      <p className="help">
        {tr(
          "Dagsbeløp er en veiledning. Grenser varsler i appen, men stopper ikke kjøp.",
        )}
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
  useI18n();
  if (!entries.length)
    return (
      <Empty title={tr("Ingen registreringer her ennå")}>
        {tr("Legg til en utgift, inntekt eller refusjon.")}
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
                  categoryLabel(
                    state.categories.find((c) => c.id === t.categoryId),
                  )}
              </strong>
              <small>
                {categoryLabel(
                  state.categories.find((c) => c.id === t.categoryId),
                )}{" "}
                · {dateLabel(t.date)} ·{" "}
                {
                  {
                    expense: tr("Utgift"),
                    income: tr("Inntekt"),
                    refund: tr("Refusjon"),
                  }[t.type]
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
              aria-label={tr("Rediger {name}", {
                name: t.title || tr("registrering"),
              })}
              onClick={() => edit(t)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button quiet"
              aria-label={tr("Slett {name}", {
                name: t.title || tr("registrering"),
              })}
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
  useI18n();
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
          {tr("Legg til registrering")}
        </Btn>
      </div>
      <div className="money-summary">
        <div>
          <span>{tr("Utgifter etter refusjoner")}</span>
          <strong>{money(f.spent)}</strong>
        </div>
        <div>
          <span>{tr("Inntekter")}</span>
          <strong>{money(f.income)}</strong>
        </div>
        <div>
          <span>{tr("Igjen av totalbudsjett")}</span>
          <strong
            className={
              f.remaining !== null && f.remaining < 0 ? "negative" : ""
            }
          >
            {f.remaining === null ? tr("Ikke satt") : money(f.remaining)}
          </strong>
        </div>
        <div>
          <span>{tr("Registrert saldo · i dag")}</span>
          <strong>
            {registered === null ? tr("Ikke satt") : money(registered)}
          </strong>
        </div>
      </div>
      {f.budget?.total != null && (
        <p
          className={
            f.remaining !== null && f.remaining < 0
              ? "notice negative"
              : "help section-note"
          }
        >
          {f.remaining !== null && f.remaining < 0
            ? tr("{amount} over totalbudsjettet.", {
                amount: money(-f.remaining),
              })
            : f.spent >= (f.budget.total * state.settings.danger) / 100
              ? tr("Totalgrensen er nådd.")
              : f.spent >= (f.budget.total * state.settings.warning) / 100
                ? tr("Du nærmer deg totalgrensen.")
                : tr("Innenfor totalgrensen.")}
          {allowance(f.remaining, month) !== null && (
            <>
              {" "}
              {tr(
                "Veiledning: {amount} per dag resten av måneden, inkludert i dag.",
                { amount: money(allowance(f.remaining, month)!) },
              )}
            </>
          )}
        </p>
      )}
      <div className="finance-grid">
        <BudgetList state={state} month={month} edit={budget} />
        <section className="panel">
          <div className="section-head">
            <h2>{tr("Registreringer")}</h2>
            <span className="subtle">
              {rows.length === 1
                ? tr("1 treff")
                : tr("{count} treff", { count: rows.length })}
            </span>
          </div>
          <div className="filters">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label={tr("Søk i transaksjoner")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("Søk etter butikk eller notat")}
              />
            </label>
            <select
              aria-label={tr("Filtrer kategori")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{tr("Alle kategorier")}</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <input
              aria-label={tr("Filtrer dato")}
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
                {tr("Nullstill filtre")}
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
        {tr(
          "Registrert saldo bygger bare på det du har ført, og er ikke en banksaldo. Utgifter uten kategoribudsjett er også med i totalen.",
        )}
      </p>
    </>
  );
}
