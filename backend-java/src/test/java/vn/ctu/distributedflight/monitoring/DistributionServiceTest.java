package vn.ctu.distributedflight.monitoring;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import org.junit.jupiter.api.*;
import vn.ctu.distributedflight.repository.DistributionRepository;
import vn.ctu.distributedflight.repository.DistributionRepository.*;
import vn.ctu.distributedflight.service.ApiException;
class DistributionServiceTest {
    DistributionRepository repo;DistributionService service;
    UUID id(int i){return new UUID(0,i);}
    DataRow row(int i){return new DataRow(id(i),id(i),"VE-"+i,"CONFIRMED","2026-11-13T00:00:00Z");}
    @BeforeEach void setup(){repo=mock(DistributionRepository.class);service=new DistributionService(repo);}
    @Test void rejectsBadFiltersBeforeDatabaseAccess(){
        assertThrows(ApiException.class,()->service.browse("cockroach","bookings;drop table x","","","",null,20));
        assertThrows(ApiException.class,()->service.browse("cockroach","bookings","","","",null,1000));
        assertThrows(ApiException.class,()->service.browse("cockroach","bookings","","","", "garbage",20));
        assertThrows(ApiException.class,()->service.browse("cassandra","booking_events_by_day","","bad-date","",null,20));
        assertThrows(ApiException.class,()->service.browse("cassandra","booking_events_by_booking","","","",null,20));
        verifyNoInteractions(repo);
    }
    @Test void keysetPaginationHasNoLostExtraRow(){
        when(repo.sqlRows("bookings","",null,21)).thenReturn(java.util.stream.IntStream.rangeClosed(1,21).mapToObj(this::row).toList());
        when(repo.sqlPlacement(eq("bookings"),any())).thenReturn(new Placement(7L,1,List.of("1","2","3")));
        var page=service.browse("cockroach","bookings","","","",null,20);
        assertEquals(20,page.rows().size());assertTrue(page.hasMore());assertEquals(id(20).toString(),page.nextCursor());
        verify(repo,never()).sqlPlacement("bookings",id(21));
        when(repo.sqlRows("bookings","",id(20),21)).thenReturn(List.of(row(21)));
        var next=service.browse("cockroach","bookings","","","",page.nextCursor(),20);
        assertEquals(id(21).toString(),next.rows().get(0).id());assertFalse(next.hasMore());
    }
    @Test void filteredScanCanReturnEmptyPageWithContinuation(){
        when(repo.sqlRows("bookings","",null,101)).thenReturn(java.util.stream.IntStream.rangeClosed(1,101).mapToObj(this::row).toList());
        when(repo.sqlPlacement(eq("bookings"),any())).thenReturn(new Placement(7L,1,List.of("1")));
        var page=service.browse("cockroach","bookings","","","2",null,20);
        assertTrue(page.rows().isEmpty());assertTrue(page.hasMore());assertEquals(100,page.scanned());assertEquals(id(100).toString(),page.nextCursor());
        verify(repo,times(100)).sqlPlacement(eq("bookings"),any());
    }
    @Test void unknownPlacementIsNotShownAsNoReplicas(){
        when(repo.sqlRows("bookings","",null,21)).thenReturn(List.of(row(1)));
        when(repo.sqlPlacement(anyString(),any())).thenThrow(new IllegalStateException());
        assertEquals("UNKNOWN",service.browse("cockroach","bookings","","","",null,20).rows().get(0).placementStatus());
        when(repo.sqlRows("bookings","",null,101)).thenReturn(List.of(row(1)));
        assertThrows(ApiException.class,()->service.browse("cockroach","bookings","","","1",null,20));
    }
    @Test void cassandraUsesPartitionAndDriverCursor(){
        String key=id(1).toString();
        when(repo.cqlReplicas("booking_events_by_booking",key)).thenReturn(List.of("10.0.0.1"));
        when(repo.cqlRows("booking_events_by_booking",key,null,20)).thenReturn(new CqlPage(List.of(row(1)),"next"));
        var result=service.browse("cassandra","booking_events_by_booking",key,"","10.0.0.1",null,20);
        assertEquals("next",result.nextCursor());assertEquals(key,result.rows().get(0).partition());
        assertTrue(service.browse("cassandra","booking_events_by_booking",key,"","10.0.0.2",null,20).rows().isEmpty());
        verify(repo,times(1)).cqlRows(anyString(),anyString(),any(),anyInt());
    }
    @Test void countFailuresAreNullAndCached(){
        when(repo.cqlCount("booking_events_by_booking")).thenReturn(1000L);
        when(repo.cqlCount("booking_events_by_day")).thenThrow(new IllegalStateException());
        var result=service.counts();assertEquals(1000L,result.tables().get(0).rows());assertNull(result.tables().get(1).rows());
        assertSame(result,service.counts());verify(repo,times(2)).cqlCount(anyString());
    }
}
