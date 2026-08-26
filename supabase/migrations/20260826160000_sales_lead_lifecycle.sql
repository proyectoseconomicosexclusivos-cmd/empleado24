-- The sales assistant already owns the commercial lead model. Extend the
-- existing lifecycle instead of creating a parallel CRM or conversation store.

alter table public.sales_assistant_leads
  drop constraint if exists sales_assistant_leads_commercial_state_check;

alter table public.sales_assistant_leads
  add constraint sales_assistant_leads_commercial_state_check
  check (commercial_state = any (array[
    'COLD', 'INTERESTED', 'VERY_INTERESTED', 'READY_TO_BUY', 'CLIENT',
    'NEW', 'CONTACTED', 'CONVERSATION', 'QUALIFIED', 'DEMO', 'PROPOSAL',
    'CHECKOUT', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT'
  ]));

alter table public.sales_assistant_conversations
  drop constraint if exists sales_assistant_conversations_commercial_state_check;

alter table public.sales_assistant_conversations
  add constraint sales_assistant_conversations_commercial_state_check
  check (commercial_state = any (array[
    'COLD', 'INTERESTED', 'VERY_INTERESTED', 'READY_TO_BUY', 'CLIENT',
    'NEW', 'CONTACTED', 'CONVERSATION', 'QUALIFIED', 'DEMO', 'PROPOSAL',
    'CHECKOUT', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT'
  ]));

-- A browser visitor is one commercial identity. The existing idempotency key
-- remains the write key; this index prevents separate lead rows when a visitor
-- returns to enrich the same recommendation.
create unique index if not exists sales_assistant_leads_anonymous_id_unique
  on public.sales_assistant_leads (anonymous_id)
  where anonymous_id is not null;
