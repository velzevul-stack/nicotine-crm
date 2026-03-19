'use client';

import { motion } from 'framer-motion';

interface ProductCardProps {
  brand: string;
  flavor: string;
  category: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  onClick?: () => void;
  delay?: number;
}

export function ProductCard({
  brand,
  flavor,
  category,
  stock,
  buyPrice,
  sellPrice,
  onClick,
  delay = 0,
}: ProductCardProps) {
  const isLowStock = stock < 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-card rounded-[20px] p-5 hover:bg-muted transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-foreground mb-1 text-base font-semibold tracking-tight">
            {brand}
          </h4>
          <p className="text-muted-foreground text-sm font-normal">{flavor}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            isLowStock
              ? 'bg-destructive/20 text-destructive-foreground'
              : 'bg-muted text-primary'
          }`}
        >
          {stock} шт
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{category}</div>
        <div className="flex gap-3 text-sm">
          <span className="text-muted-foreground">{buyPrice}₽</span>
          <span className="text-primary font-semibold">{sellPrice}₽</span>
        </div>
      </div>
    </motion.div>
  );
}
