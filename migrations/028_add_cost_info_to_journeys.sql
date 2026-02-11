-- Migration: Add cost_info to journeys table
-- Free text field for owners to inform crew about journey costs. No validation, nullable.

alter table public.journeys
  add column if not exists cost_info text;

comment on column public.journeys.cost_info is 'Free text for owners to describe cost expectations (e.g. shared food, fuel split, crew fee). Semantics left to owner.';
