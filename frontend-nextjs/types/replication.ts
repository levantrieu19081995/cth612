export interface CockroachNodeShare { nodeId:number;address:string;live:boolean;leaseholderRanges:number;replicaRanges:number;sizeMb:number; }
export interface TableShare { table:string;rows:number;ranges:number;sizeMb:number;rangesByCopies:Record<string,number>; }
export interface CockroachReplication {
  status:"AVAILABLE"|"PARTIAL"|"UNAVAILABLE";targetReplicas:number|null;liveNodes:number;knownNodes:number;ranges:number;
  minCopies:number;maxCopies:number;rangesWithoutMajority:number;nodes:CockroachNodeShare[];tables:TableShare[];error:string|null;
}
export interface CassandraReplicationNode { address:string;datacenter:string;state:string; }
export interface CassandraReplication {
  status:"AVAILABLE"|"UNAVAILABLE";keyspace:string|null;strategy:string|null;replicationFactor:number|null;consistency:string|null;
  nodesInDatacenter:number;liveNodes:number;copiesPerRow:number|null;requiredForWrite:number|null;liveCopiesWorstCase:number|null;
  writableWorstCase:boolean|null;nodes:CassandraReplicationNode[];error:string|null;
}
export interface Placement { bookingId:string;bookingCode:string;rangeId:number|null;leaseHolder:number|null;cockroachReplicas:number[];cassandraReplicas:string[]; }
export interface ReplicationSnapshot { cockroach:CockroachReplication;cassandra:CassandraReplication;samples:Placement[];observedAt:string; }
