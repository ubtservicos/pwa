# Épico 02: Esquema de Dados e Tipagem Global
**Módulo:** Core / Database
**Status:** Execução

## 1. Objetivo
Estabelecer o contrato de dados entre o Front-end e o Supabase. A aplicação deve possuir uma tipagem TypeScript rigorosa (Database Types) para garantir previsibilidade e evitar erros em tempo de execução ao manipular registros.

## 2. Esquema Core Inicial (Tabelas)
O modelo de dados primário deve contemplar as seguintes estruturas lógicas:

- **Tabela `profiles`** (Vinculada ao Supabase Auth via trigger)
  - `id`: UUID (Primary Key, referenciando `auth.users`)
  - `role`: Enum ('admin', 'cliente', 'mototaxi', 'diarista', 'ambulante')
  - `full_name`: String
  - `phone`: String
  - `document`: String (CPF/CNPJ)
  - `created_at`: Timestamp
  - `is_kyc_approved`: Boolean (Controle de aprovação de prestadores)

## 3. Especificação Técnica (Front-end)
- **Arquivo de Tipos:** Deve ser criado um arquivo central em `src/types/database.types.ts` exportando as interfaces que representam o esquema acima.
- **Injeção de Tipo:** O client configurado em `src/lib/supabase.ts` deve ser tipado utilizando essas definições para que funções como `supabase.from('profiles').select('*')` possuam autocomplete e validação do TypeScript.