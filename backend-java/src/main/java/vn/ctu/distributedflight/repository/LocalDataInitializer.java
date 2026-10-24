package vn.ctu.distributedflight.repository;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.*;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.boot.*;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@Profile({"local","demo"})
public class LocalDataInitializer implements ApplicationRunner {
    private final DataSource source;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    public LocalDataInitializer(DataSource source,JdbcTemplate jdbc,PlatformTransactionManager manager) {
        this.source=source; this.jdbc=jdbc; this.transaction=new TransactionTemplate(manager);
    }
    @Override public void run(ApplicationArguments args) {
        new ResourceDatabasePopulator(new ClassPathResource("db/cockroach-schema.sql")).execute(source);
        transaction.executeWithoutResult(status->{
            airport("SGN","Tân Sơn Nhất","TP. Hồ Chí Minh");
            airport("HAN","Nội Bài","Hà Nội");
            airport("DAD","Đà Nẵng","Đà Nẵng");
            airport("VCA","Cần Thơ","Cần Thơ");
            flight("VN-DEMO-101","SGN","HAN",1,9,"VN","Vietnam Airlines");
            flight("VN-DEMO-102","SGN","DAD",1,14,"VJ","VietJet Air");
            flight("VN-DEMO-103","VCA","HAN",2,10,"QH","Bamboo Airways");
            flight("VN-DEMO-104","HAN","SGN",2,16,"VN","Vietnam Airlines");
        });
    }
    private UUID id(String key) { return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)); }
    private void airport(String code,String name,String city) {
        jdbc.update("INSERT INTO airports(id,code,name,city) VALUES (?,?,?,?) ON CONFLICT (id) DO NOTHING",id("airport:"+code),code,name,city);
    }
    private void flight(String number,String origin,String destination,int day,int hour,String airlineCode,String airlineName) {
        LocalDate departureDate=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(day);
        String flightKey=number+":"+departureDate;
        UUID flightId=id("flight:"+flightKey);
        Instant departure=departureDate.atTime(hour,0)
            .atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
        jdbc.update("""
            INSERT INTO flights(id,flight_no,origin_airport_id,destination_airport_id,departure_time,arrival_time,status)
            VALUES (?,?,?,?,?,?,'SCHEDULED') ON CONFLICT (id) DO NOTHING
            """,flightId,number,id("airport:"+origin),id("airport:"+destination),
            Timestamp.from(departure),Timestamp.from(departure.plusSeconds(7200)));
        jdbc.update("UPDATE flights SET airline_code=?,airline_name=? WHERE id=?",airlineCode,airlineName,flightId);
        // Stable IDs preserve existing bookings and seat states on restart.
        for(int row=1;row<=6;row++) for(char col='A';col<='F';col++) {
            String seat="%02d%c".formatted(row,col);
            String cabinClass=row<=2?"ECONOMY":row<=4?"PREMIUM_ECONOMY":"BUSINESS";
            jdbc.update("""
                INSERT INTO flight_seats(id,flight_id,seat_no,cabin_class,status)
                VALUES (?,?,?,?, 'AVAILABLE')
                ON CONFLICT (id) DO UPDATE SET cabin_class=excluded.cabin_class
                WHERE flight_seats.status='AVAILABLE'
                """,id("seat:"+flightKey+":"+seat),flightId,seat,cabinClass);
        }
    }
}
