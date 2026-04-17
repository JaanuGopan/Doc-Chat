import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Use DIRECT_URL for migrations/setup
DSN = os.environ.get("DIRECT_URL")

def setup_database():
    if not DSN:
        print("❌ DIRECT_URL not found in .env")
        return

    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(DSN)
        conn.autocommit = True
        with conn.cursor() as cur:
            print("Enabling pgvector extension...")
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            print("Creating documents table...")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                  user_id     uuid NOT NULL,
                  filename    text NOT NULL,
                  file_hash   text NOT NULL,
                  storage_path text NOT NULL,
                  chunk_count  integer DEFAULT 0,
                  created_at  timestamptz DEFAULT now()
                );
            """)

            print("Creating/Updating document_chunks table...")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS document_chunks (
                  id          bigserial PRIMARY KEY,
                  session_id  text,
                  source      text,
                  page        integer,
                  chunk_index integer,
                  content     text        NOT NULL,
                  embedding   vector(384) NOT NULL,
                  created_at  timestamptz DEFAULT now()
                );
            """)
            
            # Migration: Add document_id column if it doesn't exist
            cur.execute("""
                ALTER TABLE document_chunks 
                ADD COLUMN IF NOT EXISTS document_id uuid 
                REFERENCES documents(id) ON DELETE CASCADE;
            """)

            # Ensure session_id is not null so migration works
            cur.execute("ALTER TABLE document_chunks ALTER COLUMN session_id DROP NOT NULL;")
            
            print("Creating index...")
            cur.execute("""
                CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
                  ON document_chunks
                  USING ivfflat (embedding vector_cosine_ops)
                  WITH (lists = 100);
            """)
            
            # Add index on document_id for faster retrieval
            cur.execute("CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);")
            
            print("Applying Row Level Security (RLS) policies...")
            cur.execute("ALTER TABLE documents ENABLE ROW LEVEL SECURITY;")
            cur.execute("DROP POLICY IF EXISTS \"Users can insert their own documents\" ON documents;")
            cur.execute("CREATE POLICY \"Users can insert their own documents\" ON documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);")
            cur.execute("DROP POLICY IF EXISTS \"Users can view their own documents\" ON documents;")
            cur.execute("CREATE POLICY \"Users can view their own documents\" ON documents FOR SELECT TO authenticated USING (auth.uid() = user_id);")
            cur.execute("DROP POLICY IF EXISTS \"Users can delete their own documents\" ON documents;")
            cur.execute("CREATE POLICY \"Users can delete their own documents\" ON documents FOR DELETE TO authenticated USING (auth.uid() = user_id);")
            
        print("✅ Database setup successfully!")
        conn.close()
    except Exception as e:
        print(f"❌ Error setting up database: {e}")

if __name__ == "__main__":
    setup_database()
