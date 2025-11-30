-- RPC: crear_movimiento
-- Objetivo:
--   Registra un nuevo movimiento financiero (ingreso o egreso) y actualiza
--   el saldo disponible del usuario. Opcionalmente permite registrar un aporte
--   a una meta de ahorro en la misma transacción.
--
-- Parámetros:
--   p_usuario_id  → Usuario que realiza el movimiento
--   p_tipo        → Tipo de movimiento ("ingreso" o "egreso")
--   p_monto       → Monto del movimiento
--   p_comentario  → Comentario o descripción del movimiento
--   p_fecha       → Fecha en que se realizó el movimiento
--   p_concepto_id → Concepto financiero asociado (opcional)
--   p_meta_id     → Meta a la que se desea aportar (opcional)
--   p_monto_meta  → Monto del aporte a la meta (opcional, requiere p_meta_id)
--
-- Reglas:
--   - El usuario debe existir
--   - Para egresos, el saldo disponible debe ser suficiente
--   - Si se especifica meta y monto de aporte, se registra el ahorro automáticamente
--   - El aporte a meta actualiza el monto_actual de la meta
--
-- Retorna:
--   ID del movimiento creado

CREATE OR REPLACE FUNCTION crear_movimiento(
    p_usuario_id   UUID,
    p_tipo         CHAR,
    p_monto        NUMERIC,
    p_comentario   TEXT,
    p_fecha        DATE,
    p_concepto_id  UUID DEFAULT NULL,
    p_meta_id      UUID DEFAULT NULL,
    p_monto_meta   NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_movimiento_id UUID;
    v_saldo_actual NUMERIC;
BEGIN
    -- Obtener saldo del usuario
    SELECT saldo_disponible
    INTO v_saldo_actual
    FROM usuarios
    WHERE id = p_usuario_id;

    IF v_saldo_actual IS NULL THEN
        RAISE EXCEPTION 'El usuario no existe';
    END IF;

    -- Validar egreso
    IF p_tipo = 'egreso' AND v_saldo_actual < p_monto THEN
        RAISE EXCEPTION 'Saldo insuficiente para realizar el egreso';
    END IF;

    -- Insertar movimiento
    INSERT INTO movimientos (
        usuario_id, tipo, monto, comentario, fecha, concepto_id
    ) VALUES (
        p_usuario_id, p_tipo, p_monto, p_comentario, p_fecha, p_concepto_id
    )
    RETURNING id INTO v_movimiento_id;

    -- Actualizar saldo
    IF p_tipo = 'ingreso' THEN
        UPDATE usuarios
        SET saldo_disponible = saldo_disponible + p_monto
        WHERE id = p_usuario_id;
    ELSE
        UPDATE usuarios
        SET saldo_disponible = saldo_disponible - p_monto
        WHERE id = p_usuario_id;
    END IF;

    -- Manejar aporte a meta
    IF p_meta_id IS NOT NULL AND p_monto_meta IS NOT NULL THEN
        
        -- Insertar registro de ahorro
        INSERT INTO ahorro (meta_id, movimiento_id, monto)
        VALUES (p_meta_id, v_movimiento_id, p_monto_meta);

        -- Actualizar meta
        UPDATE metas
        SET monto_actual = monto_actual + p_monto_meta
        WHERE id = p_meta_id;

    END IF;

    RETURN v_movimiento_id;

END;
$$;

-- RPC: actualizar_movimiento
-- Objetivo:
--   Actualiza los campos editables de un movimiento financiero (monto, fecha, comentario)
--   y ajusta automáticamente el saldo disponible del usuario para reflejar los cambios.
--
-- Parámetros:
--   p_movimiento_id → ID del movimiento a modificar
--   p_monto         → Nuevo monto del movimiento (opcional, mantiene el actual si es null)
--   p_fecha         → Nueva fecha del movimiento (opcional, mantiene la actual si es null)
--   p_comentario    → Nuevo comentario (opcional, mantiene el actual si es null)
--
-- Reglas:
--   - El movimiento debe existir
--   - El monto debe ser mayor que cero
--   - Los egresos no pueden tener aportes a metas asociados
--   - El saldo resultante del usuario no puede quedar negativo
--
-- Retorna:
--   Movimiento actualizado con los nuevos valores

create or replace function actualizar_movimiento(
  p_movimiento_id uuid,
  p_monto numeric,
  p_fecha date,
  p_comentario text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_mov movimientos%rowtype;
  v_old_aporte_total numeric := 0;
  v_new_aporte_total numeric := 0;
  v_delta_saldo numeric := 0;
  v_nuevo_saldo numeric;
  v_new_monto numeric;
  v_new_fecha date;
  v_new_comentario text;
begin
  -- 1) Obtener el movimiento actual
  select *
  into v_mov
  from movimientos
  where id = p_movimiento_id;

  if not found then
    raise exception 'Movimiento no encontrado.';
  end if;

  -- 2) Aporte ligado al movimiento (no se puede cambiar)
  select coalesce(sum(monto), 0)
  into v_old_aporte_total
  from ahorro
  where movimiento_id = p_movimiento_id;

  v_new_aporte_total := v_old_aporte_total;

  -- 3) Normalizar campos editables
  v_new_monto := coalesce(p_monto, v_mov.monto);
  v_new_fecha := coalesce(p_fecha, v_mov.fecha);
  v_new_comentario := coalesce(p_comentario, v_mov.comentario);

  if v_new_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  -- 4) Calcular impacto sobre saldo_disponible
  if v_mov.tipo = 'ingreso' then

    -- efecto viejo y nuevo
    v_delta_saldo :=
      (v_new_monto - v_new_aporte_total)
      - (v_mov.monto - v_old_aporte_total);

  elsif v_mov.tipo = 'egreso' then

    -- un egreso nunca tiene ahorro asociado
    if v_old_aporte_total > 0 then
      raise exception 'Un egreso no puede tener un aporte asociado a una meta.';
    end if;

    v_delta_saldo := (-v_new_monto) - (-v_mov.monto);

  else
    raise exception 'Tipo de movimiento no válido: %', v_mov.tipo;
  end if;

  -- 5) Aplicar delta al saldo del usuario
  update usuarios
  set saldo_disponible = saldo_disponible + v_delta_saldo
  where id = v_mov.usuario_id
  returning saldo_disponible into v_nuevo_saldo;

  if v_nuevo_saldo < 0 then
    raise exception 'Saldo insuficiente para aplicar esta modificación';
  end if;

  -- 6) Actualizar SOLO campos editables
  update movimientos
  set
    monto = v_new_monto,
    fecha = v_new_fecha,
    comentario = v_new_comentario
  where id = p_movimiento_id;

  -- 7) Retornar movimiento actualizado
  return (
    select to_jsonb(m)
    from movimientos m
    where m.id = p_movimiento_id
  );

end;
$$;

-- RPC: obtener_total_por_tipo
-- Objetivo:
--   Obtiene los movimientos de un usuario filtrados por tipo (ingreso/egreso)
--   y período específico, permitiendo calcular totales en el cliente.
--
-- Parámetros:
--   p_usuario_id → Usuario propietario de los movimientos
--   p_tipo       → Tipo de movimiento a consultar ("ingreso" o "egreso")
--   p_fecha      → Fecha específica para filtrar (opcional)
--   p_mes        → Mes a filtrar de 1 a 12 (opcional, requiere p_anio)
--   p_anio       → Año a filtrar (opcional, requiere p_mes)
--
-- Reglas:
--   - Si se proporciona p_fecha, filtra exactamente por esa fecha
--   - Si se proporcionan p_mes y p_anio, filtra por ese mes y año específicos
--   - Los filtros de fecha y mes/año son mutuamente excluyentes
--
-- Retorna:
--   Lista de montos de los movimientos que cumplen los criterios de búsqueda

create or replace function obtener_total_por_tipo(
  p_usuario_id uuid,
  p_tipo text,
  p_fecha date default null,
  p_mes int default null,
  p_anio int default null
)
returns table(monto numeric)
language plpgsql
security definer
as $$
begin
  return query
  select m.monto
  from movimientos m
  where m.usuario_id = p_usuario_id
    and m.tipo = p_tipo
    and (p_fecha is null or m.fecha = p_fecha)
    and (
      p_mes is null or p_anio is null
      or extract(month from m.fecha) = p_mes
      and extract(year from m.fecha) = p_anio
    );
end;
$$;

-- RPC: obtener_movimientos_usuario
-- Objetivo:
--   Obtiene el historial de movimientos financieros de un usuario con información
--   del concepto asociado, permitiendo filtrar por mes/año y ordenar resultados.
--
-- Parámetros:
--   p_usuario_id → Usuario propietario de los movimientos
--   p_limit      → Cantidad máxima de resultados (por defecto 50)
--   p_asc        → Orden ascendente por fecha (por defecto false, orden descendente)
--   p_mes        → Mes a filtrar de 1 a 12 (opcional, requiere p_anio)
--   p_anio       → Año a filtrar (opcional, requiere p_mes)
--
-- Reglas:
--   - Si se proporcionan p_mes y p_anio, filtra por ese período específico
--   - Incluye información del concepto asociado mediante LEFT JOIN
--   - Los resultados se ordenan por fecha según el parámetro p_asc
--
-- Retorna:
--   Lista de movimientos con sus campos principales y datos del concepto asociado

create or replace function obtener_movimientos_usuario(
  p_usuario_id uuid,
  p_limit int default 50,
  p_asc boolean default false,
  p_mes int default null,
  p_anio int default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  resultado jsonb;
begin
  select jsonb_agg(row_to_json(t))
  into resultado
  from (
    select
      m.id,
      m.usuario_id,
      m.concepto_id,
      m.tipo,
      m.monto,
      m.comentario,
      m.fecha,
      c.id as concepto_id_ref,
      c.nombre as concepto_nombre
    from movimientos m
    left join conceptos c on c.id = m.concepto_id
    where m.usuario_id = p_usuario_id
      and (
        p_mes is null or p_anio is null or
        extract(month from m.fecha) = p_mes and extract(year from m.fecha) = p_anio
      )
    order by m.fecha asc nulls last
  ) t;

  return resultado;
end;
$$;
-- RPC: movimiento_por_id
-- Objetivo:
--   Obtiene un movimiento específico con toda su información relacionada,
--   incluyendo datos del concepto y usuario asociados.
--
-- Parámetros:
--   p_movimiento_id → ID del movimiento a consultar
--
-- Reglas:
--   - El movimiento debe existir, de lo contrario genera excepción
--   - Incluye información completa del concepto asociado
--   - Incluye información básica del usuario propietario
--
-- Retorna:
--   Movimiento con datos del concepto y usuario anidados

create or replace function movimiento_por_id(
  p_movimiento_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', m.id,
    'usuario_id', m.usuario_id,
    'concepto_id', m.concepto_id,
    'tipo', m.tipo,
    'monto', m.monto,
    'comentario', m.comentario,
    'fecha', m.fecha,
    'conceptos', jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'tipo', c.tipo
    ),
    'usuario', jsonb_build_object(
        'id', u.id,
        'nombre', u.nombre
    )
  )
  into result
  from movimientos m
  left join conceptos c on c.id = m.concepto_id
  left join usuarios u on u.id = m.usuario_id
  where m.id = p_movimiento_id;

  if result is null then
    raise exception 'Movimiento no encontrado';
  end if;

  return result;
end;
$$;

-- RPC: movimientos_rango_fechas
-- Objetivo:
--   Obtiene movimientos dentro de un rango de fechas, permitiendo consultar
--   transacciones personales o de toda la familia según el tipo especificado.
--
-- Parámetros:
--   p_usuario_id   → Usuario que realiza la consulta
--   p_tipo         → Alcance de la consulta ("personal" o "familiar")
--   p_fecha_inicio → Fecha inicial del período a consultar
--   p_fecha_fin    → Fecha final del período a consultar
--
-- Reglas:
--   - Si p_tipo es "personal", retorna solo movimientos del usuario actual
--   - Si p_tipo es "familiar", retorna movimientos de todos los miembros de la familia
--   - Si el usuario no pertenece a una familia y solicita tipo "familiar", retorna lista vacía
--   - El tipo debe ser "personal" o "familiar", cualquier otro valor genera excepción
--   - Los resultados incluyen información del usuario y concepto asociados
--
-- Retorna:
--   Lista de movimientos en el rango de fechas con datos de usuario y concepto anidados

create or replace function movimientos_rango_fechas(
  p_usuario_id uuid,
  p_tipo text,               -- 'personal' o 'familiar'
  p_fecha_inicio date,
  p_fecha_fin date
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_usuario_ids uuid[];
  resultado jsonb;
begin

  -- 1) Determinar usuarios aplicables
  if p_tipo = 'personal' then
    -- Solo el usuario actual
    v_usuario_ids := ARRAY[p_usuario_id];

  elsif p_tipo = 'familiar' then
    -- Obtener su familia
    select array_agg(id)
    into v_usuario_ids
    from usuarios
    where familia_id = (
      select familia_id from usuarios where id = p_usuario_id
    );

    -- Si no tiene familia → no hay movimientos
    if v_usuario_ids is null or array_length(v_usuario_ids, 1) = 0 then
      return '[]'::jsonb;
    end if;

  else
    raise exception 'Tipo no válido: %, se esperaba personal o familiar', p_tipo;
  end if;


  -- 2) Seleccionar movimientos + joins
  select jsonb_agg(row_to_json(t))
  into resultado
  from (
    select 
      m.*,
      jsonb_build_object(
        'id', u.id,
        'nombre', u.nombre
      ) as usuario,
      jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'tipo', c.tipo
      ) as concepto
    from movimientos m
    left join usuarios u on u.id = m.usuario_id
    left join conceptos c on c.id = m.concepto_id
    where m.fecha >= p_fecha_inicio
      and m.fecha <= p_fecha_fin
      and m.usuario_id = any(v_usuario_ids)
    order by m.fecha asc
  ) t;

  return resultado;

end;
$$;

-- RPC: movimientos_con_conceptos
-- Objetivo:
--   Obtiene movimientos de un usuario con información completa del concepto asociado,
--   útil para generar análisis y reportes categorizados.
--
-- Parámetros:
--   p_usuario_id → Usuario propietario de los movimientos
--   p_limit      → Cantidad máxima de resultados (por defecto 100)
--   p_asc        → Orden ascendente por fecha (por defecto false, orden descendente)
--
-- Reglas:
--   - Los resultados se ordenan por fecha según el parámetro p_asc
--   - Incluye información completa del concepto mediante LEFT JOIN
--   - Limita la cantidad de resultados según p_limit
--
-- Retorna:
--   Lista de movimientos con datos del concepto anidados

create or replace function movimientos_con_conceptos(
  p_usuario_id uuid,
  p_limit int default 100,
  p_asc boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  resultado jsonb;
begin
  select jsonb_agg(row_to_json(t))
  into resultado
  from (
    select
      m.id,
      m.monto,
      m.fecha,
      m.concepto_id,
      jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'tipo', c.tipo
      ) as conceptos
    from movimientos m
    left join conceptos c on c.id = m.concepto_id
    where m.usuario_id = p_usuario_id
    order by m.fecha asc nulls last
    limit p_limit
  ) t;
  return resultado;
end;
$$;

-- RPC: filtrar_movimientos_avanzado
-- Objetivo:
--   Consulta movimientos aplicando múltiples filtros simultáneos (usuarios, concepto,
--   rango de fechas), con opciones de ordenamiento y límite de resultados.
--
-- Parámetros:
--   p_usuarios_ids → Array de IDs de usuarios cuyos movimientos se desean consultar (requerido)
--   p_concepto_id  → Filtrar por concepto específico (opcional)
--   p_fecha_inicio → Fecha inicial del rango a consultar (opcional)
--   p_fecha_fin    → Fecha final del rango a consultar (opcional)
--   p_asc          → Orden ascendente por fecha (por defecto false, orden descendente)
--   p_limit        → Cantidad máxima de resultados (opcional)
--
-- Reglas:
--   - Debe proporcionar al menos un ID de usuario en el array
--   - Incluye información del concepto, usuario y aporte a meta asociados
--   - Los filtros son opcionales y se aplican de forma combinada
--
-- Retorna:
--   Conjunto de movimientos con datos relacionados (concepto, usuario, aporte) anidados

create or replace function filtrar_movimientos_avanzado(
  p_usuarios_ids uuid[],
  p_concepto_id uuid default null,
  p_fecha_inicio date default null,
  p_fecha_fin date default null,
  p_asc boolean default false,
  p_limit integer default null
)
returns setof jsonb
language plpgsql
as $$
declare
  sql_base text;
  sql_final text;
begin
  -- Validación mínima
  if p_usuarios_ids is null or array_length(p_usuarios_ids, 1) = 0 then
    raise exception 'Debe proporcionar al menos un ID de usuario.';
  end if;
  -- Base del query
  sql_base := '
    select to_jsonb(m.*)
      || jsonb_build_object(
          ''concepto'', to_jsonb(c.*),
          ''usuario'', jsonb_build_object(''nombre'', u.nombre),
          ''aporte'', to_jsonb(a)
        ) as registro
    from movimientos m
      left join conceptos c on c.id = m.concepto_id
      left join usuarios u on u.id = m.usuario_id
      left join ahorro a on a.movimiento_id = m.id
    where m.usuario_id = any($1)
  ';
  -- Filtros dinámicos
  if p_concepto_id is not null then
    sql_base := sql_base || ' and m.concepto_id = ' || quote_literal(p_concepto_id);
  end if;
  if p_fecha_inicio is not null then
    sql_base := sql_base || ' and m.fecha >= ' || quote_literal(p_fecha_inicio);
  end if;
  if p_fecha_fin is not null then
    sql_base := sql_base || ' and m.fecha <= ' || quote_literal(p_fecha_fin);
  end if;
  -- Orden
  sql_base := sql_base || ' order by m.fecha ' || case when p_asc then 'asc' else 'desc' end;
  -- Límite (opcional)
  if p_limit is not null then
    sql_base := sql_base || ' limit ' || p_limit;
  end if;
  -- Ejecutar
  return query execute sql_base using p_usuarios_ids;
end $$;