BEGIN;

DROP TABLE IF EXISTS tasks CASCADE;

DELETE FROM employee_resources
WHERE category = 'sticky_note';

COMMIT;
