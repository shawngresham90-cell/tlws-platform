-- Enrichment canary: 10 rows, distinct states + interstates, both fields, from the master.
-- Same guards as ENRICH.sql. One transaction.

do $$
declare n integer;
begin
  update public.locations l set interstate=v.val from (values
    ('4d83a5f4-3a68-4047-a6b3-cc2724e32ea3','I-20'),
    ('09c2f55b-774e-4670-8120-e8f282978c00','I-57'),
    ('1722ae34-d370-4a32-b4d0-3ef0f6a1e6ba','I-10'),
    ('5853847c-19b3-4623-912f-4d965355ea1e','I-5'),
    ('1af7e56a-9913-49a4-99c2-9ab5af0dcdb3','I-25'),
    ('b1a810d9-fa26-4b9f-a829-7ff3a327a6ed','I-84'),
    ('354bc376-dbe6-4584-b8a5-1b4ec6e55c70','I-4'),
    ('15de1227-c048-4efc-9434-ac55e17356f1','I-75'),
    ('3e8796c6-77f4-4c8c-9832-e46e040689c5','I-80'),
    ('8b16110b-263b-41f1-81f7-f05a3c028b11','I-15')
  ) v(id,val) where l.id=v.id::uuid and l.source='official-ta-petro-20260725-5ebe0e9f' and (l.interstate is null or btrim(l.interstate)='');
  get diagnostics n=row_count; if n<>10 then raise exception 'canary interstate: expected 10 got %',n; end if;
  update public.locations l set exit_number=v.val from (values
    ('4d83a5f4-3a68-4047-a6b3-cc2724e32ea3','168'),
    ('09c2f55b-774e-4670-8120-e8f282978c00','48'),
    ('1722ae34-d370-4a32-b4d0-3ef0f6a1e6ba','340'),
    ('5853847c-19b3-4623-912f-4d965355ea1e','630'),
    ('1af7e56a-9913-49a4-99c2-9ab5af0dcdb3','254'),
    ('b1a810d9-fa26-4b9f-a829-7ff3a327a6ed','28'),
    ('354bc376-dbe6-4584-b8a5-1b4ec6e55c70','10'),
    ('15de1227-c048-4efc-9434-ac55e17356f1','201'),
    ('3e8796c6-77f4-4c8c-9832-e46e040689c5','197'),
    ('8b16110b-263b-41f1-81f7-f05a3c028b11','137')
  ) v(id,val) where l.id=v.id::uuid and l.source='official-ta-petro-20260725-5ebe0e9f' and (l.exit_number is null or btrim(l.exit_number)='');
  get diagnostics n=row_count; if n<>10 then raise exception 'canary exit: expected 10 got %',n; end if;
  raise notice 'canary enriched 10 rows';
end $$;
