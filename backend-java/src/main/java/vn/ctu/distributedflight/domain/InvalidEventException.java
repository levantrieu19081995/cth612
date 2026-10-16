package vn.ctu.distributedflight.domain;
public class InvalidEventException extends RuntimeException {
    public InvalidEventException(Throwable cause) { super("Invalid stored event payload",cause); }
}
