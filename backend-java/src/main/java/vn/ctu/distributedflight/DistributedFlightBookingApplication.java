package vn.ctu.distributedflight;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class DistributedFlightBookingApplication {
    public static void main(String[] args) {
        SpringApplication.run(DistributedFlightBookingApplication.class, args);
    }
}
