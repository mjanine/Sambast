import argparse
import csv
import re
import sqlite3
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).with_name("database.db")
DEFAULT_CSV_PATH = Path(__file__).with_name("sambast_inventory_list_v2.csv")

CANONICAL_COLUMNS = [
	"name",
	"category",
	"price",
	"stock_status",
	"image_filename",
	"description",
	"purpose",
	"target_species",
	"tags",
]

HEADER_ALIASES = {
	"name": ["name", "product", "product_name", "item_name"],
	"category": ["category", "type"],
	"price": ["price", "unit_price", "srp", "price_per_kg_php"],
	"stock_status": ["stock_status", "stock", "stock_count", "quantity", "qty"],
	"image_filename": ["image_filename", "image", "image_file", "photo"],
	"description": ["description", "desc", "details"],
	"purpose": ["purpose"],
	"target_species": ["target_species", "species", "pet_type", "target_pet_type"],
	"tags": ["tags", "keywords"],
}


def normalize_header(text):
	value = (text or "").strip().lower()
	value = re.sub(r"[^a-z0-9]+", "_", value)
	return value.strip("_")


def infer_category(name, description, target_species):
	text = f"{name} {description} {target_species}".lower()

	medicine_markers = [
		"deworm",
		"vitamin",
		"multivitamin",
		"antibi",
		"soap",
		"treatment",
		"parasite",
		"levamisole",
		"albendazole",
		"para-v",
	]
	supplies_markers = [
		"feeder",
		"shampoo",
		"litter",
		"leash",
		"collar",
		"toy",
		"bowl",
	]

	if any(marker in text for marker in medicine_markers):
		return "Medicine"
	if any(marker in text for marker in supplies_markers):
		return "Supplies"
	return "Feeds"


def build_header_map(fieldnames):
	normalized_to_actual = {normalize_header(name): name for name in (fieldnames or [])}
	header_map = {}

	for canonical in CANONICAL_COLUMNS:
		actual_name = None
		for alias in HEADER_ALIASES[canonical]:
			normalized_alias = normalize_header(alias)
			if normalized_alias in normalized_to_actual:
				actual_name = normalized_to_actual[normalized_alias]
				break
		header_map[canonical] = actual_name

	return header_map


def csv_get(row, header_map, key, default_value=""):
	actual_name = header_map.get(key)
	if not actual_name:
		return default_value
	value = row.get(actual_name, default_value)
	return value.strip() if isinstance(value, str) else value


def parse_float(value):
	if value is None:
		return None
	text = str(value).strip()
	if not text:
		return None
	text = text.replace("₱", "").replace(",", "")
	try:
		return float(text)
	except ValueError:
		return None


def parse_int(value, default_value=0):
	if value is None:
		return default_value
	text = str(value).strip()
	if not text:
		return default_value
	try:
		return int(float(text))
	except ValueError:
		return default_value


def ensure_products_table(conn):
	conn.execute(
		'''
		CREATE TABLE IF NOT EXISTS products (
			product_id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			category TEXT,
			price REAL NOT NULL,
			stock_status INTEGER DEFAULT 1,
			image_filename TEXT,
			description TEXT
		)
		'''
	)


def get_table_columns(conn, table_name):
	rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
	return {row[1] for row in rows}


def seed_products(db_path, csv_path, replace_existing=True, truncate=False, dry_run=False):
	if not csv_path.exists():
		raise FileNotFoundError(f"CSV file not found: {csv_path}")

	conn = sqlite3.connect(str(db_path))
	conn.execute("PRAGMA foreign_keys = ON")

	try:
		ensure_products_table(conn)
		available_columns = get_table_columns(conn, "products")

		if truncate:
			conn.execute("DELETE FROM products")

		inserted = 0
		updated = 0
		skipped = 0
		invalid = 0

		with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
			reader = csv.DictReader(csv_file)
			header_map = build_header_map(reader.fieldnames)

			if not header_map.get("name") or not header_map.get("price"):
				raise ValueError("CSV must contain columns for product name and price.")

			for line_number, row in enumerate(reader, start=2):
				name = csv_get(row, header_map, "name")
				price = parse_float(csv_get(row, header_map, "price"))

				if not name or price is None:
					invalid += 1
					print(f"Skipping invalid row {line_number}: missing name or price")
					continue

				category = csv_get(row, header_map, "category", "")
				description = csv_get(row, header_map, "description", "")
				target_species = csv_get(row, header_map, "target_species", "")
				if not category:
					category = infer_category(name, description, target_species)

				record = {
					"name": name,
					"category": category,
					"price": price,
					"stock_status": parse_int(csv_get(row, header_map, "stock_status", 20), 20),
					"image_filename": csv_get(row, header_map, "image_filename", "logo.png"),
					"description": description,
					"purpose": csv_get(row, header_map, "purpose", ""),
					"target_species": target_species,
					"tags": csv_get(row, header_map, "tags", ""),
				}

				insertable = {
					column: value
					for column, value in record.items()
					if column in available_columns
				}

				existing = conn.execute(
					"SELECT product_id FROM products WHERE LOWER(name) = LOWER(?)",
					(name,),
				).fetchone()

				if existing:
					if not replace_existing:
						skipped += 1
						continue

					if not dry_run:
						set_clause = ", ".join([f"{column} = ?" for column in insertable.keys()])
						values = list(insertable.values()) + [existing[0]]
						conn.execute(
							f"UPDATE products SET {set_clause} WHERE product_id = ?",
							values,
						)
					updated += 1
				else:
					if not dry_run:
						column_clause = ", ".join(insertable.keys())
						placeholder_clause = ", ".join(["?"] * len(insertable))
						conn.execute(
							f"INSERT INTO products ({column_clause}) VALUES ({placeholder_clause})",
							list(insertable.values()),
						)
					inserted += 1

		if dry_run:
			conn.rollback()
		else:
			conn.commit()

		total = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
		mode = "DRY-RUN" if dry_run else "APPLIED"
		print(f"Seed completed ({mode}).")
		print(f"Inserted: {inserted}")
		print(f"Updated: {updated}")
		print(f"Skipped: {skipped}")
		print(f"Invalid rows: {invalid}")
		print(f"Products in table: {total}")

	finally:
		conn.close()


def parse_args():
	parser = argparse.ArgumentParser(
		description="Seed the products table from sambast_inventory_list_v2.csv"
	)
	parser.add_argument(
		"--db",
		default=str(DEFAULT_DB_PATH),
		help="Path to the SQLite database file (default: database.db)",
	)
	parser.add_argument(
		"--csv",
		default=str(DEFAULT_CSV_PATH),
		help="Path to the source CSV file (default: sambast_inventory_list_v2.csv)",
	)
	parser.add_argument(
		"--truncate",
		action="store_true",
		help="Delete existing products before seeding",
	)
	parser.add_argument(
		"--skip-existing",
		action="store_true",
		help="Do not update products that already exist by name",
	)
	parser.add_argument(
		"--dry-run",
		action="store_true",
		help="Preview seeding result without writing to the database",
	)
	return parser.parse_args()


if __name__ == "__main__":
	args = parse_args()
	seed_products(
		db_path=Path(args.db),
		csv_path=Path(args.csv),
		replace_existing=not args.skip_existing,
		truncate=args.truncate,
		dry_run=args.dry_run,
	)
