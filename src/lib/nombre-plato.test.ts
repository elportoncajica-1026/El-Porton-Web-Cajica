import { describe, it, expect } from 'vitest';
import { nombreConCategoria } from '@/lib/nombre-plato';

describe('nombreConCategoria', () => {
  it('distingue la hamburguesa de la mazorcada que se llaman igual', () => {
    expect(nombreConCategoria('Tres Carnes', 'hamburguesas')).toBe('Hamburguesa Tres Carnes');
    expect(nombreConCategoria('Tres Carnes', 'mazorcadas')).toBe('Mazorcada Tres Carnes');
  });

  it('también los perros', () => {
    expect(nombreConCategoria('Clásico', 'perros')).toBe('Perro Clásico');
    expect(nombreConCategoria('Todo Terreno', 'perros')).toBe('Perro Todo Terreno');
  });

  it('no repite la palabra si el nombre ya la trae', () => {
    expect(nombreConCategoria('Choriperro', 'perros')).toBe('Choriperro');
    expect(nombreConCategoria('Perro Clásico', 'perros')).toBe('Perro Clásico');
    expect(nombreConCategoria('Mazorcada (Pollo, Res o Cerdo)', 'mazorcadas')).toBe(
      'Mazorcada (Pollo, Res o Cerdo)',
    );
  });

  it('no toca las categorías cuyos nombres ya se explican solos', () => {
    expect(nombreConCategoria('Salchipapa Mixta', 'salchipapas')).toBe('Salchipapa Mixta');
    expect(nombreConCategoria('Pizza Familiar', 'pizzas')).toBe('Pizza Familiar');
    expect(nombreConCategoria('Costillas BBQ', 'carnes')).toBe('Costillas BBQ');
    expect(nombreConCategoria('Gaseosa Coca-Cola', 'bebidas')).toBe('Gaseosa Coca-Cola');
  });

  it('sin categoría (pedidos antiguos) deja el nombre tal cual', () => {
    expect(nombreConCategoria('Tres Carnes')).toBe('Tres Carnes');
    expect(nombreConCategoria('Tres Carnes', 'otra-cosa')).toBe('Tres Carnes');
  });
});
