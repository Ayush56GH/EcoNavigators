import os
import glob
from db.connection import get_connection

migration_files = sorted(glob.glob('db/migrations/*.sql'))

conn = get_connection()
cur = conn.cursor()

for mfile in migration_files:
    print(f'Applying migration {mfile}...')
    with open(mfile, 'r', encoding='utf-8-sig') as f:
        sql = f.read()
    cur.execute(sql)
    conn.commit()

# Verify new indexes
cur.execute("SELECT indexname FROM pg_indexes WHERE tablename = 'ais_positions'")
indexes = [r[0] for r in cur.fetchall()]
print('ais_positions indexes:', indexes)

# Verify new columns on sar_detections
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'sar_detections'")
columns = [r[0] for r in cur.fetchall()]
print('sar_detections columns:', columns)

# Verify incidents table
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents'")
inc_columns = [r[0] for r in cur.fetchall()]
print('incidents columns:', inc_columns)

conn.close()
print('Migrations successfully applied!')

