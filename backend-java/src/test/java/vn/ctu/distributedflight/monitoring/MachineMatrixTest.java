package vn.ctu.distributedflight.monitoring;

import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MachineMatrixTest {
    private static final List<String> IDS=List.of("PC1","PC2","PC3","PC4");
    private MonitorConfiguration.Properties nodes() {
        return new MonitorConfiguration.Properties("LAN_FOUR_PHYSICAL_NODES",IDS.stream().map(id->
            new MonitorConfiguration.Node(id,"node-"+id,"http://127.0.0.1/health","127.0.0.1",9042)).toList());
    }
    private List<MonitoringService.Machine> observations(String failed) {
        return IDS.stream().map(id->{String state=id.equals(failed)?"OFFLINE":"ONLINE";
            return new MonitoringService.Machine(id,"node-"+id,state,state,state.equals("ONLINE")?"REACHABLE":"UNKNOWN","127.0.0.1","127.0.0.1");}).toList();
    }
    private MachineMatrix.Host host(String id,List<String> assigned) {
        return new MachineMatrix.Host(id,id,"192.0.2.10","Máy dữ liệu",assigned,List.of());
    }
    @Test void fourNodePairsAreOnePhysicalMachineEvenWhenOnePairStops() {
        var matrix=new MachineMatrix(new MachineMatrix.Properties(List.of(host("DESKTOP",IDS))),nodes());
        var result=matrix.observe(observations("PC2"),Map.of());
        assertEquals(1,result.size());
        assertEquals("REACHABLE",result.get(0).status());
        assertEquals(6,result.get(0).respondingServices());
        assertEquals(8,result.get(0).totalServices());
    }
    @Test void physicalInventoryIncludesApplicationMachineAndDoesNotGreenDisconnectedHosts() {
        List<MachineMatrix.Host> hosts=new ArrayList<>(IDS.stream().map(id->host(id,List.of(id))).toList());
        hosts.add(new MachineMatrix.Host("PC5","APPLICATION-PC","192.0.2.15","Máy ứng dụng",List.of(),
            List.of(new MachineMatrix.Endpoint("backend","Backend Java","http://127.0.0.1/ping"))));
        var matrix=new MachineMatrix(new MachineMatrix.Properties(hosts),nodes());
        var result=matrix.observe(observations("PC2"),Map.of("PC5:backend","ONLINE"));
        assertEquals(5,result.size());
        assertEquals(4,result.stream().filter(h->h.status().equals("REACHABLE")).count());
        assertEquals("UNREACHABLE",result.get(1).status());
        assertEquals("192.0.2.15",result.get(4).ip());
        assertEquals("APPLICATION-PC",result.get(4).name());
    }
    @Test void missingObservationsRemainUnknownInsteadOfOfflineOrOnline() {
        var matrix=new MachineMatrix(new MachineMatrix.Properties(List.of(host("DESKTOP",IDS))),nodes());
        var initial=matrix.observe(List.of(),Map.of()).get(0);
        assertEquals("UNKNOWN",initial.status());
        assertEquals(0,initial.respondingServices());
        assertEquals(8,initial.totalServices());
    }
    @Test void rejectsDoubleCountingAndUnownedNodes() {
        assertThrows(IllegalArgumentException.class,()->new MachineMatrix(new MachineMatrix.Properties(
            List.of(host("A",IDS),host("B",List.of("PC2")))),nodes()));
        assertThrows(IllegalArgumentException.class,()->new MachineMatrix(new MachineMatrix.Properties(
            List.of(host("A",List.of("PC1")))),nodes()));
        assertThrows(IllegalArgumentException.class,()->new MachineMatrix(new MachineMatrix.Properties(
            List.of(host("A",List.of("NOT_CONFIGURED")))),nodes()));
    }
}
