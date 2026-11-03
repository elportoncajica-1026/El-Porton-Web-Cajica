import { describe, expect, it } from 'vitest';
import { direccionAGuardar, esTipoPedido, horaLegible, tipoDeDireccion } from './tipo-pedido';

describe('horaLegible', () => {
  it('pasa la hora del selector a formato de 12 horas', () => {
    expect(horaLegible('19:30')).toBe('7:30 p.m.');
    expect(horaLegible('12:05')).toBe('12:05 p.m.');
    expect(horaLegible('00:15')).toBe('12:15 a.m.');
    expect(horaLegible('9:00')).toBe('9:00 a.m.');
  });
  it('vacío o inválido no imprime nada', () => {
    expect(horaLegible('')).toBe('');
    expect(horaLegible(undefined)).toBe('');
    expect(horaLegible('25:00')).toBe('');
    expect(horaLegible('siete')).toBe('');
  });
});

describe('direccionAGuardar / tipoDeDireccion', () => {
  it('el domicilio guarda la dirección tal cual', () => {
    expect(direccionAGuardar('domicilio', 'Cl 4 #5-10', '19:00')).toBe('Cl 4 #5-10');
    expect(tipoDeDireccion('Cl 4 #5-10')).toBe('domicilio');
  });
  it('recoger y restaurante guardan una frase fija, con la hora si la hay', () => {
    expect(direccionAGuardar('recoger', 'Cl 4', '19:30')).toBe('Recoge en el local · llega 7:30 p.m.');
    expect(direccionAGuardar('restaurante', '', '')).toBe('Come en el restaurante');
  });
  it('el panel reconoce el tipo desde lo guardado', () => {
    expect(tipoDeDireccion(direccionAGuardar('recoger', '', '20:00'))).toBe('recoger');
    expect(tipoDeDireccion(direccionAGuardar('restaurante', '', ''))).toBe('restaurante');
    expect(tipoDeDireccion('')).toBe('domicilio');
    expect(tipoDeDireccion(null)).toBe('domicilio');
  });
  it('solo acepta los tres tipos', () => {
    expect(esTipoPedido('recoger')).toBe(true);
    expect(esTipoPedido('mesa')).toBe(false);
    expect(esTipoPedido(undefined)).toBe(false);
  });
});
