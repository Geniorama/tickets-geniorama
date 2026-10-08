-- Perfil del sistema para quien solo lleva la facturación.
--
-- El módulo se podía conceder a mano desde «Acceso a módulos», pero ningún
-- perfil lo traía: en el selector no había nada que dijera «Facturación», y
-- armar el caso obligaba a poner un módulo en Gestor y apagar el resto uno a
-- uno. Va en Gestor porque quien lleva los cobros también los borra y anula.
--
-- Solo datos: el valor FACTURACION del enum ya existe desde la v1.79.0.
INSERT INTO "access_profiles" ("id", "name", "description", "grants", "is_system", "updated_at") VALUES
  ('prf_facturacion', 'Facturación',
   'Gestiona cobros, facturas y abonos. Sin tickets, proyectos ni administración.',
   '{"FACTURACION":"GESTOR"}',
   true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
