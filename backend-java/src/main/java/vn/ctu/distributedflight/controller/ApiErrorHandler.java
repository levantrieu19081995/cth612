package vn.ctu.distributedflight.controller;
import java.util.Map;
import java.util.UUID;
import org.slf4j.*;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import vn.ctu.distributedflight.service.ApiException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;

@RestControllerAdvice
public class ApiErrorHandler {
    private static final Logger log=LoggerFactory.getLogger(ApiErrorHandler.class);
    record Error(String code, String message, String traceId, Map<String,Object> details) {}
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Error> business(ApiException ex) {
        return ResponseEntity.status(ex.status()).body(error(ex.code(),ex.getMessage()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,MethodArgumentTypeMismatchException.class,HttpMessageNotReadableException.class})
    ResponseEntity<Error> invalid(Exception ex) {
        return ResponseEntity.badRequest().body(error("INVALID_REQUEST","Thông tin gửi lên không hợp lệ."));
    }
    @ExceptionHandler({DataAccessException.class,org.springframework.transaction.TransactionException.class})
    ResponseEntity<Error> database(RuntimeException ex) {
        Error result=error("DATABASE_TEMPORARILY_UNAVAILABLE","Database tạm thời không thể xử lý. Vui lòng thử lại.");
        log.warn("Database request failed; traceId={}, type={}",result.traceId(),ex.getClass().getSimpleName());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(result);
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<Error> unexpected(Exception ex) {
        Error result=error("INTERNAL_ERROR","Không thể xử lý yêu cầu.");
        log.error("Unhandled request failure; traceId={}, type={}",result.traceId(),ex.getClass().getSimpleName());
        return ResponseEntity.internalServerError().body(result);
    }
    private Error error(String code,String message) {
        return new Error(code,message,UUID.randomUUID().toString(),Map.of());
    }
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Error> missing(NoResourceFoundException ex) {
        return ResponseEntity.status(404).body(error("NOT_FOUND","Không tìm thấy endpoint."));
    }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Error> method(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(405).body(error("METHOD_NOT_ALLOWED","Phương thức HTTP không được hỗ trợ."));
    }
}
