-- D-057: smaller search data.
-- 1. The HNSW index (37 MB) was never used: it was built for cosine distance, while search_library
--    ranks by inner product (<#>), so Postgres always scanned instead. Search takes ~0.3 s without it.
-- 2. Embeddings stored at half precision (halfvec): ~1.5 KB → ~0.8 KB per text piece, same search results.
drop index if exists public.document_chunks_embedding_idx;

alter table public.document_chunks
  alter column embedding type extensions.halfvec(384) using embedding::extensions.halfvec(384);

create or replace function public.search_library(query_embedding extensions.vector, query_text text, preferred_subject uuid default null, match_count integer default 6)
returns table(chunk_id bigint, document_id uuid, title text, page_number integer, content text, source_type public.source_type, status public.doc_status, subject_id uuid, score double precision)
language sql
stable
set search_path = ''
as $$
  with q as (select query_embedding::extensions.halfvec(384) as e),
  candidates as (
    select c.id
    from public.document_chunks c
    join public.documents d on d.id = c.document_id, q
    where d.visibility = 'shared' and d.processing = 'ready' and c.embedding is not null
    order by c.embedding operator(extensions.<#>) q.e
    limit 40
  ),
  keyword as (
    select c.id
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where d.visibility = 'shared' and d.processing = 'ready'
      and c.fts @@ websearch_to_tsquery('english', query_text)
    limit 20
  ),
  pool as (select id from candidates union select id from keyword)
  select c.id, c.document_id, d.title, c.page_number, c.content, d.source_type, d.status, d.subject_id,
    ( coalesce(-(c.embedding operator(extensions.<#>) q.e), 0)
      + 0.15 * least(ts_rank(c.fts, websearch_to_tsquery('english', query_text)), 1)
      + case d.source_type when 'official_guidance' then 0.08 when 'textbook' then 0.06
                           when 'school_material' then 0.04 when 'review_center' then 0.02 else 0 end
      + case when preferred_subject is not null and d.subject_id = preferred_subject then 0.05 else 0 end
      - case when d.status = 'archived' then 0.05 else 0 end
    )::double precision as score
  from pool
  join public.document_chunks c on c.id = pool.id
  join public.documents d on d.id = c.document_id
  cross join q
  order by score desc
  limit least(match_count, 12);
$$;
