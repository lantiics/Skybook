CREATE TABLE filters (
    identifier TEXT PRIMARY KEY, -- This should be the filter name
    filter TEXT NOT NULL
);
CREATE TABLE instance_filters (
    instance TEXT NOT NULL REFERENCES instances(name) ON DELETE CASCADE,
    filter TEXT NOT NULL REFERENCES filters(identifier) ON DELETE CASCADE,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (instance, filter)
);