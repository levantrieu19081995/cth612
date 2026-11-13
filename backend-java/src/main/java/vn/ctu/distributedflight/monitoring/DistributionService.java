package vn.ctu.distributedflight.monitoring;

import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vn.ctu.distributedflight.repository.DistributionRepository;
import vn.ctu.distributedflight.repository.DistributionRepository.DataRow;
import vn.ctu.distributedflight.service.ApiException;

@Service
public class DistributionService {
    public record RecordRow(String id,String bookingId,String label,String status,String occurredAt,Long rangeId,Integer leaseholder,List<String> replicas,String placementStatus,String partition) {}
    public record Page(List<RecordRow> rows,String nextCursor,boolean hasMore,int scanned,String observedAt) {}
    public record Count(String table,Long rows,String status,String observedAt) {}
    public record Counts(List<Count> tables,String observedAt) {}
    private final DistributionRepository repository;
    private Counts cachedCounts;
    private long countedAt;
    public DistributionService(DistributionRepository repository) {this.repository=repository;}
    private ApiException invalid(String message) {return new ApiException(HttpStatus.BAD_REQUEST,"INVALID_DISTRIBUTION_FILTER",message);}
    public Page browse(String database,String table,String query,String date,String node,String cursor,int limit) {
        if(limit!=20&&limit!=50&&limit!=100)throw invalid("Số dòng mỗi trang phải là 20, 50 hoặc 100.");
        if(query.length()>100||node.length()>200||(cursor!=null&&cursor.length()>8192))throw invalid("Bộ lọc quá dài.");
        if(database.equals("cockroach")) {
            if(!DistributionRepository.SQL_TABLES.contains(table))throw invalid("Bảng CockroachDB không hợp lệ.");
            if(!date.isEmpty())throw invalid("Bộ lọc ngày chỉ dùng cho bảng sự kiện theo ngày.");
            UUID after=null;
            try {if(cursor!=null)after=UUID.fromString(cursor);if(!node.isEmpty()&&Integer.parseInt(node)<1)throw new IllegalArgumentException();}
            catch(IllegalArgumentException ex){throw invalid("Node hoặc con trỏ phân trang không hợp lệ.");}
            // Never load the whole dataset. A filtered page scans at most 100 records.
            int budget=node.isEmpty()?limit:100;
            List<DataRow> batch=repository.sqlRows(table,query,after,budget+1);
            List<RecordRow> result=new ArrayList<>();int scanned=0;
            for(DataRow row:batch) {
                if(scanned==budget||result.size()==limit)break;
                scanned++;after=row.id();
                DistributionRepository.Placement placement=null;
                try {placement=repository.sqlPlacement(table,row.id());}catch(RuntimeException ignored){}
                if(!node.isEmpty()&&(placement==null||!placement.replicas().contains(node))) {
                    if(placement==null||placement.rangeId()==null)throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"PLACEMENT_UNAVAILABLE","Không đọc được vị trí để lọc theo node.");
                    continue;
                }
                result.add(convert(row,placement==null?null:placement.rangeId(),placement==null?null:placement.leaseholder(),placement==null?List.of():placement.replicas(),placement==null||placement.rangeId()==null?"UNKNOWN":"METADATA",null));
            }
            boolean more=scanned<batch.size();
            return new Page(result,more&&after!=null?after.toString():null,more,scanned,Instant.now().toString());
        }
        if(!database.equals("cassandra")||!DistributionRepository.CQL_TABLES.contains(table))throw invalid("Database hoặc bảng không hợp lệ.");
        String partition;
        if(table.equals("booking_events_by_day")) {
            if(!query.isEmpty())throw invalid("Chọn ngày cho bảng sự kiện theo ngày; không kết hợp mã vé.");
            try {partition=LocalDate.parse(date).toString();}catch(RuntimeException ex){throw invalid("Cần ngày hợp lệ theo định dạng YYYY-MM-DD (UTC).");}
        } else {
            if(!date.isEmpty())throw invalid("Không kết hợp ngày với partition mã vé.");
            if(query.isBlank())throw invalid("Nhập UUID hoặc mã vé để xem partition Cassandra.");
            try {partition=UUID.fromString(query).toString();}
            catch(IllegalArgumentException ex){partition=repository.bookingId(query).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"BOOKING_NOT_FOUND","Không tìm thấy mã vé.")).toString();}
        }
        try {
            List<String> replicas=repository.cqlReplicas(table,partition);
            if(!node.isEmpty()&&!replicas.contains(node))return new Page(List.of(),null,false,0,Instant.now().toString());
            var page=repository.cqlRows(table,partition,cursor,limit);
            String key=partition;
            return new Page(page.rows().stream().map(r->convert(r,null,null,replicas,"METADATA",key)).toList(),page.cursor(),page.cursor()!=null,page.rows().size(),Instant.now().toString());
        }catch(IllegalArgumentException ex){throw invalid("Con trỏ Cassandra không hợp lệ hoặc không thuộc partition này.");}
        catch(RuntimeException ex){if(ex instanceof ApiException a)throw a;throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"CASSANDRA_UNAVAILABLE","Không đọc được Cassandra hoặc token metadata.");}
    }
    private RecordRow convert(DataRow row,Long range,Integer holder,List<String> replicas,String state,String partition) {
        return new RecordRow(row.id().toString(),row.bookingId()==null?null:row.bookingId().toString(),row.label(),row.status(),row.occurredAt(),range,holder,replicas,state,partition);
    }
    /** Explicit refresh only, rate limited by a 60-second cache; timeouts are unknown, never zero. */
    public synchronized Counts counts() {
        if(cachedCounts!=null&&System.currentTimeMillis()-countedAt<60000)return cachedCounts;
        List<Count> rows=new ArrayList<>();
        for(String table:new TreeSet<>(DistributionRepository.CQL_TABLES)) {
            try {rows.add(new Count(table,repository.cqlCount(table),"EXACT",Instant.now().toString()));}
            catch(RuntimeException ex){rows.add(new Count(table,null,"UNAVAILABLE",Instant.now().toString()));}
        }
        cachedCounts=new Counts(rows,Instant.now().toString());countedAt=System.currentTimeMillis();return cachedCounts;
    }
}
