-- One commercial lifecycle for Laura, Meta, checkout and the CEO funnel.
-- Values are derived from actual events; no parallel CRM state is introduced.

update public.sales_assistant_leads
set commercial_state = case commercial_state
  when 'CLIENT' then 'CUSTOMER'
  when 'READY_TO_BUY' then 'QUALIFIED'
  when 'VERY_INTERESTED' then 'QUALIFYING'
  when 'INTERESTED' then 'QUALIFYING'
  when 'COLD' then 'NEW'
  when 'CONVERSATION' then 'CONTACTED'
  else commercial_state
end
where commercial_state in ('CLIENT', 'READY_TO_BUY', 'VERY_INTERESTED', 'INTERESTED', 'COLD', 'CONVERSATION');

update public.sales_assistant_conversations
set commercial_state = case commercial_state
  when 'CLIENT' then 'CUSTOMER'
  when 'READY_TO_BUY' then 'QUALIFIED'
  when 'VERY_INTERESTED' then 'QUALIFYING'
  when 'INTERESTED' then 'QUALIFYING'
  when 'COLD' then 'NEW'
  when 'CONVERSATION' then 'CONTACTED'
  else commercial_state
end
where commercial_state in ('CLIENT', 'READY_TO_BUY', 'VERY_INTERESTED', 'INTERESTED', 'COLD', 'CONVERSATION');

alter table public.sales_assistant_leads
  drop constraint if exists sales_assistant_leads_commercial_state_check;
alter table public.sales_assistant_leads
  add constraint sales_assistant_leads_commercial_state_check
  check (commercial_state = any (array[
    'NEW', 'CONTACTED', 'QUALIFYING', 'QUALIFIED', 'DEMO', 'PROPOSAL',
    'CHECKOUT', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT'
  ]));

alter table public.sales_assistant_conversations
  drop constraint if exists sales_assistant_conversations_commercial_state_check;
alter table public.sales_assistant_conversations
  add constraint sales_assistant_conversations_commercial_state_check
  check (commercial_state = any (array[
    'NEW', 'CONTACTED', 'QUALIFYING', 'QUALIFIED', 'DEMO', 'PROPOSAL',
    'CHECKOUT', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT'
  ]));
