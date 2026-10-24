export type ServiceStatus="ONLINE"|"OFFLINE"|"UNKNOWN";
export type SystemStatus="HEALTHY"|"DEGRADED"|"UNAVAILABLE"|"UNKNOWN";
export interface OutboxStats { pending:number;published:number;failed:number;oldestPendingAgeMs:number; }
export interface Cluster {activeNodes:number;expectedNodes:number;registeredNodes:number|null;status:SystemStatus;queryAvailable:boolean;}
export interface PhysicalMachine {
  machineId:string;name:string;ip:string|null;role:string|null;
  status:"REACHABLE"|"UNREACHABLE"|"UNKNOWN";
  respondingServices:number;totalServices:number;
  services:{name:string;status:ServiceStatus}[];
}
export interface MonitoringOverview {
  mode:string;systemStatus:SystemStatus;
  machines:{machineId:string;host:string;cockroach:ServiceStatus;cassandra:ServiceStatus;hostObservation:string;cockroachAddress?:string|null;cassandraAddress?:string|null}[];
  physicalMachines?:PhysicalMachine[];
  cockroach:Cluster;cassandra:Cluster;outbox:OutboxStats|null;
  transitions:{machineId:string;service:string;before:string;after:string;observedAt:string}[];
  observedAt:string|null;
}
export interface AnalyticsSummary {
  business:{bookings:number;confirmed:number;payments:number;demoRevenue:number;flights:number;availableSeats:number};
  outbox:OutboxStats;eventsToday:number|null;eventStoreStatus:string;eventDateUtc:string;observedAt:string;
}
export interface TimelineType {
  events:{eventId:string;eventType:string;bookingId:string;occurredAt:string;payloadVersion:number;payload:unknown}[];
  pendingEvents:number;synchronizedEvents:boolean;observedAt:string;
}
