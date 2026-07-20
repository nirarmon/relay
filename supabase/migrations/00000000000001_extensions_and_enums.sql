-- 00000000000001_extensions_and_enums.sql
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pgcrypto;

create type org_type as enum ('OPO', 'OPERATOR', 'TRANSPLANT_CENTER');
create type hospital_type as enum ('DONOR', 'RECIPIENT', 'BOTH');

create type organ_type as enum ('HEART', 'LUNG', 'LIVER', 'PANCREAS', 'KIDNEY');
create type preservation_method as enum ('STATIC_COLD', 'MACHINE_PERFUSION');
create type organ_status as enum ('VIABLE', 'DELIVERED', 'NON_VIABLE', 'LOST');

create type mission_status as enum (
  'OfferReceived', 'MissionCreated', 'CarrierRequested', 'CarrierAssigned',
  'Positioning', 'TeamAtDonor', 'CustodyStarted',
  'InTransitGround1', 'InTransitAir', 'InTransitGround2',
  'Delivered', 'Closed',
  'Exception_Delay', 'Exception_Divert', 'Exception_Declined', 'Exception_MissedWindow'
);
create type sla_state as enum ('ON_TIME', 'AT_RISK', 'BREACHED');

create type leg_mode as enum ('GROUND', 'AIR');
create type leg_endpoint_type as enum ('HOSPITAL', 'AIRPORT');
create type call_sign_category as enum ('MEDEVAC', 'COMPASSION', 'NONE');
create type leg_status as enum ('PLANNED', 'ACTIVE', 'COMPLETE');

create type custody_event_type as enum ('TAKE', 'HANDOFF', 'PACKAGE_SCAN', 'INSPECT');
create type proof_type as enum ('SIGNATURE', 'PHOTO', 'BARCODE');

create type aircraft_status as enum ('AVAILABLE', 'ON_MISSION', 'IN_MAINTENANCE', 'AOG');
create type source_system as enum ('NATIVE', 'FL3XX', 'LEON', 'FLIGHTDOCS', 'VERYON');
create type pilot_currency_status as enum ('CURRENT', 'EXPIRING', 'EXPIRED');
create type duty_record_type as enum ('ON_CALL', 'DUTY', 'FLIGHT', 'REST');
create type duty_record_source as enum ('MANUAL', 'SYSTEM');
create type crew_role as enum ('PIC', 'SIC');
create type maintenance_type as enum ('100_HOUR', 'ANNUAL', 'AOG', 'UNSCHEDULED');
create type maintenance_status as enum ('OPEN', 'CLOSED');
create type invoice_status as enum ('DRAFT', 'SENT', 'PAID', 'OVERDUE');
