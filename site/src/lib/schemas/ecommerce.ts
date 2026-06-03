import { z } from 'zod';

export const userSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(2).max(60),
	email: z.string().email(),
	address: z.object({
		street: z.string(),
		city: z.string(),
		state: z.string(),
		zip: z.string(),
		country: z.string()
	}),
	createdAt: z.date()
});

export const categorySchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(2).max(40),
	slug: z.string(),
	parentId: z.string().uuid().nullable()
});

export const productSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(2).max(100),
	categoryId: z.string().uuid(),
	price: z.number().min(0.01).max(9999.99),
	rating: z.number().min(1).max(5)
});

export const variantSchema = z.object({
	id: z.string().uuid(),
	productId: z.string().uuid(),
	sku: z.string(),
	stock: z.number().int().min(0),
	color: z.string(),
	size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
});

export const reviewSchema = z.object({
	id: z.string().uuid(),
	productId: z.string().uuid(),
	userId: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	body: z.string().max(500),
	createdAt: z.date()
});

const orderItemSchema = z.object({
	productId: z.string().uuid(),
	variantId: z.string().uuid(),
	qty: z.number().int().min(1).max(99),
	unitPrice: z.number().min(0)
});

export const orderSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	items: z.array(orderItemSchema).min(1).max(10),
	total: z.number().min(0),
	status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
	createdAt: z.date()
});

export type User = z.infer<typeof userSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Product = z.infer<typeof productSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Order = z.infer<typeof orderSchema>;

export interface EcommerceWorld {
	users: User[];
	categories: Category[];
	products: Product[];
	variants: Variant[];
	reviews: Review[];
	orders: Order[];
}
