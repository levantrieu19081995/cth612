package vn.ctu.distributedflight.monitoring;

import java.util.*;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Maps observed services to their configured physical host, never to a database node address. */
@Component
public class MachineMatrix {
    @ConfigurationProperties("app.machine-monitor")
    public record Properties(List<Host> hosts) {
        public Properties {
            if(hosts==null||hosts.isEmpty()) throw new IllegalArgumentException("Physical machine inventory is required");
            hosts=List.copyOf(hosts);
            if(hosts.stream().map(Host::id).distinct().count()!=hosts.size()) throw new IllegalArgumentException("Duplicate physical machine ID");
        }
    }
    public record Host(String id,String name,String ip,String role,List<String> nodeIds,List<Endpoint> services) {
        public Host {
            if(id==null||id.isBlank()||name==null||name.isBlank()) throw new IllegalArgumentException("Physical machine requires an ID and name");
            nodeIds=nodeIds==null?List.of():List.copyOf(nodeIds);
            services=services==null?List.of():List.copyOf(services);
            if(nodeIds.isEmpty()&&services.isEmpty()) throw new IllegalArgumentException("Physical machine requires at least one monitored service");
            if(services.stream().map(Endpoint::id).distinct().count()!=services.size()) throw new IllegalArgumentException("Duplicate machine service ID");
        }
    }
    public record Endpoint(String id,String name,String url) {
        public Endpoint {
            if(id==null||id.isBlank()||name==null||name.isBlank()||url==null||url.isBlank()) throw new IllegalArgumentException("Machine service requires ID, name and URL");
        }
    }
    public record ServiceObservation(String name,String status) {}
    public record PhysicalMachine(String machineId,String name,String ip,String role,String status,
            int respondingServices,int totalServices,List<ServiceObservation> services) {}
    private final Properties properties;
    public MachineMatrix(Properties properties,MonitorConfiguration.Properties dataNodes) {
        this.properties=properties;
        Set<String> assigned=new HashSet<>();
        Set<String> known=new HashSet<>(dataNodes.nodes().stream().map(MonitorConfiguration.Node::id).toList());
        for(var host:properties.hosts()) for(String node:host.nodeIds()) {
            if(!known.contains(node)) throw new IllegalArgumentException("Unknown data node in machine inventory: "+node);
            if(!assigned.add(node)) throw new IllegalArgumentException("Data node belongs to more than one physical machine: "+node);
        }
        if(!assigned.equals(known)) throw new IllegalArgumentException("Every data node must belong to exactly one physical machine");
    }
    public List<Host> hosts() { return properties.hosts(); }
    public static String endpointKey(String hostId,String serviceId) { return hostId+":"+serviceId; }
    public List<PhysicalMachine> observe(List<MonitoringService.Machine> dataNodes,Map<String,String> endpointStates) {
        Map<String,MonitoringService.Machine> nodes=new HashMap<>();
        dataNodes.forEach(node->nodes.put(node.machineId(),node));
        return properties.hosts().stream().map(host->{
            List<ServiceObservation> services=new ArrayList<>();
            for(String id:host.nodeIds()) {
                var node=nodes.get(id);
                services.add(new ServiceObservation("CockroachDB · "+id,node==null?"UNKNOWN":node.cockroach()));
                services.add(new ServiceObservation("Cassandra · "+id,node==null?"UNKNOWN":node.cassandra()));
            }
            for(var service:host.services()) services.add(new ServiceObservation(service.name(),
                endpointStates.getOrDefault(endpointKey(host.id(),service.id()),"UNKNOWN")));
            int responding=(int)services.stream().filter(s->s.status().equals("ONLINE")).count();
            // A stopped database does not prove that its physical machine is off.
            String status=responding>0?"REACHABLE":services.stream().allMatch(s->s.status().equals("OFFLINE"))?"UNREACHABLE":"UNKNOWN";
            return new PhysicalMachine(host.id(),host.name(),host.ip(),host.role(),status,responding,services.size(),List.copyOf(services));
        }).toList();
    }
}
