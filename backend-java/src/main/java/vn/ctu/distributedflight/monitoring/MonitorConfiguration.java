package vn.ctu.distributedflight.monitoring;
import java.util.List;
import org.springframework.boot.context.properties.*;
import org.springframework.context.annotation.Configuration;
@Configuration
@EnableConfigurationProperties({MonitorConfiguration.Properties.class,MachineMatrix.Properties.class})
public class MonitorConfiguration {
    @ConfigurationProperties("app.monitor")
    public record Properties(String mode,List<Node> nodes) {
        public Properties {
            if(nodes==null||nodes.isEmpty()) throw new IllegalArgumentException("Monitor requires configured nodes");
            if(nodes.size()>4) throw new IllegalArgumentException("At most four data nodes");
            if(nodes.stream().map(Node::id).distinct().count()!=nodes.size()) throw new IllegalArgumentException("Duplicate monitored node ID");
        }
    }
    public record Node(String id,String host,String cockroachUrl,String cassandraHost,int cassandraPort) {}
}
