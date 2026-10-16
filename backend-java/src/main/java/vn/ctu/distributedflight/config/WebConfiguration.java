package vn.ctu.distributedflight.config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;
@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final String origin;
    public WebConfiguration(@Value("${app.frontend-origin}") String origin) { this.origin=origin; }
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins(origin).allowedMethods("GET", "POST")
                .allowedHeaders("Content-Type").maxAge(3600);
    }
    // The backend has no page of its own: its root (e.g. the public Swagger host) opens the API docs.
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addRedirectViewController("/","/swagger-ui.html");
    }
}
