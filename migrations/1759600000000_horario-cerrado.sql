-- Up Migration
-- Fase 3b: «cerrado» como dato explícito. Un registro de horario con `cerrado = true` (sin desde ni hasta) dice que el
-- local no atiende esos días; un día sin registro es un día sin dato (sin restricción), no un día cerrado.
alter table horario_local alter column desde drop not null;
alter table horario_local alter column hasta drop not null;
alter table horario_local add column cerrado boolean not null default false;
alter table horario_local drop constraint horario_local_check;
alter table horario_local add constraint horario_local_tramo_check check (
  (cerrado and desde is null and hasta is null) or (not cerrado and desde is not null and hasta is not null and hasta > desde)
);

-- Down Migration
delete from horario_local where cerrado;
alter table horario_local drop constraint horario_local_tramo_check;
alter table horario_local drop column cerrado;
alter table horario_local alter column desde set not null;
alter table horario_local alter column hasta set not null;
alter table horario_local add constraint horario_local_check check (hasta > desde);
