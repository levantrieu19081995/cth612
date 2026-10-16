package vn.ctu.distributedflight.monitoring;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class ReplicationRulesTest {
    @Test void rangeServesOnlyWithMajorityOfItsCopiesLive() {
        assertEquals(1,ReplicationService.majority(1));
        assertEquals(2,ReplicationService.majority(2));
        assertEquals(2,ReplicationService.majority(3));
        // Three copies survive one dead node, not two.
        assertTrue(ReplicationService.hasMajority(List.of(1,2,3),Set.of(1,3)));
        assertFalse(ReplicationService.hasMajority(List.of(1,2,3),Set.of(1)));
        // A single copy on a live node keeps serving; on a dead node it does not.
        assertTrue(ReplicationService.hasMajority(List.of(1),Set.of(1)));
        assertFalse(ReplicationService.hasMajority(List.of(3),Set.of(1)));
        assertFalse(ReplicationService.hasMajority(List.of(),Set.of(1)));
    }
    @Test void cassandraWriteNeedsCopiesForTheConsistencyLevel() {
        assertEquals(2,ReplicationService.requiredReplicas("LOCAL_QUORUM",3));
        assertEquals(2,ReplicationService.requiredReplicas("quorum",3));
        assertEquals(1,ReplicationService.requiredReplicas("ONE",3));
        assertEquals(3,ReplicationService.requiredReplicas("ALL",3));
        assertEquals(1,ReplicationService.requiredReplicas("LOCAL_QUORUM",1));
    }
}
