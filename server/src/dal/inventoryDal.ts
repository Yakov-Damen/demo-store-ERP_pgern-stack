import { AdminProduct } from '../types/Product';
import query from '../utils/queryDB';
import { v4 as uuidv4 } from 'uuid';

export const getAllProductsDal = async () => {
  const { rows }: any = await query(selectAll);

  return rows;
};

export const getProductByIdDal = async (id: string) => {
  const { rows }: any = await query(
    `SELECT p.id, p.name, p.price AS salePrice, p.quantity, p.description, c.name AS category, p.discount AS discountPercentage, p.rating, p.clicked AS click, i.url AS image_url, i.alt AS image_alt, c2.lng AS longitude, c2.lat AS latitude, jsonb_object_agg(t.name, tv.name) AS tags, p.isForSale, p.costPrice, p.supplier FROM products p JOIN categories c ON p.category = c.id JOIN images i ON p.image = i.id JOIN product_coordinates pc ON p.id = pc.product JOIN coordinates c2 ON pc.coordinates = c2.id LEFT JOIN product_tags pt ON p.id = pt.product LEFT JOIN tag_values tv ON pt.tag_and_value_id = tv.id LEFT JOIN tags t ON tv.tag = t.id WHERE p.id = '${id}' GROUP BY p.id, c.name, i.url, i.alt, c2.lng, c2.lat;`
  );
  return rows;
};

export const addNewProductDal = async (
  newProduct: Omit<AdminProduct, 'id'>
) => {
  // Insert image
  const imageRes = await query(
    `INSERT INTO images (url, alt) VALUES ('${newProduct.image.url}', '${newProduct.image.alt}') returning *;`
  );

  // Insert product
  const res = await query(`
        INSERT INTO products (name, price, quantity, description, image, category, discount, rating, clicked, costPrice, supplier)
        VALUES ('${newProduct.name}', ${newProduct.saleprice}, ${newProduct.quantity}, '${newProduct.description}', '${imageRes?.rows[0].id}', '${newProduct.category}', ${newProduct.discount}, ${newProduct.rating}, ${newProduct.clicked}, ${newProduct.costPrice}, '${newProduct.supplier}')
        returning *;
    `);

  const productId = res?.rows[0].id;

  // Insert tags
  for (const key in newProduct.tags) {
    const tagRes = await query(
      `INSERT INTO tags (name) VALUES ('${key}') ON CONFLICT (name) DO NOTHING returning *;`
    );
    let tagId = ' ';
    if (tagRes?.rows[0]) {
      tagId = tagRes.rows[0].id;
    } else {
      const idQuery = await query(`select id from tags where name = '${key}'`);
      tagId = idQuery?.rows[0].id;
    }

    const tagValueRes = await query(
      `INSERT INTO tag_values (name, tag) VALUES ('${newProduct.tags[key]}', '${tagId}') ON CONFLICT (name, tag) DO NOTHING returning *;`
    );
    let tagValueId = ' ';
    if (tagValueRes?.rows[0]) {
      tagValueId = tagValueRes?.rows[0].id;
    } else {
      const idQuery = await query(
        `select id from tag_values where name = '${newProduct.tags[key]}'`
      );
      tagValueId = idQuery?.rows[0].id;
    }

    await query(
      `INSERT INTO product_tags (product, tag_and_value_id) VALUES ('${productId}', '${tagValueId}') returning *;`
    );
  }

  // Insert coordinates
  const coordinatesRes = await query(
    `INSERT INTO coordinates (lat, lng) VALUES (${newProduct.coordinate.latitude}, ${newProduct.coordinate.longitude}) ON CONFLICT DO NOTHING returning *;`
  );
  let coordinatesId = ' ';
  if (coordinatesRes?.rows[0]) {
    coordinatesId = coordinatesRes.rows[0].id;
  } else {
    const idQuery = await query(
      `select id from coordinates where lat = ${newProduct.coordinate.latitude} and lng = ${newProduct.coordinate.longitude};`
    );
    coordinatesId = idQuery?.rows[0].id;
  }

  await query(
    `INSERT INTO product_coordinates (product, coordinates) VALUES ('${productId}', '${coordinatesId}') returning *;`
  );

  // Get the product by ID
  const product = await getProductByIdDal(productId);

  return product;
};

export const updateProductByIdDal = async (
  partsOfProductToUpdate: Partial<AdminProduct>,
  id: string
) => {
  const { rows: updatedProduct }: any = await query(`UPDATE products
    SET
        name = '${partsOfProductToUpdate.name || 'name'}',
        price = ${partsOfProductToUpdate.saleprice || 'price'},
        quantity = ${partsOfProductToUpdate.quantity || 'quantity'},
        description = '${partsOfProductToUpdate.description || 'description'}',
        discount = ${partsOfProductToUpdate.discount || 'discount'},
        rating = ${partsOfProductToUpdate.rating || 'rating'},
        clicked = ${partsOfProductToUpdate.clicked || 'clicked'},
        isforsale = ${partsOfProductToUpdate.isForSale || 'isforsale'},
        costprice = ${partsOfProductToUpdate.costPrice || 'costprice'},
        supplier = '${partsOfProductToUpdate.supplier || 'supplier'}'

    WHERE id = '${id}';  `);

  if (partsOfProductToUpdate.coordinate) {
    const coordinatesRes = await query(
      `INSERT INTO coordinates (lat, lng) VALUES (${partsOfProductToUpdate.coordinate.latitude}, ${partsOfProductToUpdate.coordinate.longitude}) ON CONFLICT DO NOTHING returning *;`
    );
    let coordinatesId = ' ';
    if (coordinatesRes?.rows[0]) {
      coordinatesId = coordinatesRes.rows[0].id;
    } else {
      const idQuery = await query(
        `select id from coordinates where lat = ${partsOfProductToUpdate.coordinate.latitude} and lng = ${partsOfProductToUpdate.coordinate.longitude};`
      );
      coordinatesId = idQuery?.rows[0].id;
    }

    const { rows: updatedCoordinate }: any =
      await query(`UPDATE product_coordinates
        SET 
            coordinates = '${coordinatesId}'
        WHERE product = '${id}'
        `);
  }

  if (partsOfProductToUpdate.tags) {
    for (const key in partsOfProductToUpdate.tags) {
      const tagRes = await query(
        `INSERT INTO tags (name) VALUES ('${key}') ON CONFLICT (name) DO NOTHING returning *;`
      );
      let tagId = ' ';
      if (tagRes?.rows[0]) {
        tagId = tagRes.rows[0].id;
      } else {
        const idQuery = await query(
          `select id from tags where name = '${key}'`
        );
        tagId = idQuery?.rows[0].id;
      }

      const tagValueRes = await query(
        `INSERT INTO tag_values (name, tag) VALUES ('${partsOfProductToUpdate.tags[key]}', '${tagId}') ON CONFLICT (name, tag) DO NOTHING returning *;`
      );
      let tagValueId = ' ';
      if (tagValueRes?.rows[0]) {
        tagValueId = tagValueRes?.rows[0].id;
      } else {
        const idQuery = await query(
          `select id from tag_values where name = '${partsOfProductToUpdate.tags[key]}'`
        );
        tagValueId = idQuery?.rows[0].id;
      }

      await query(
        `INSERT INTO product_tags (product, tag_and_value_id) VALUES ('${id}', '${tagValueId}') ON CONFLICT (product, tag_and_value_id) DO NOTHING returning *;`
      );
    }
  }

  if (partsOfProductToUpdate.image) {
    const { rows: imageId }: any = await query(
      `select image from products where id = '${id}'`
    );
    const { rows: updatedImage }: any = await query(`UPDATE images
        SET 
            url = '${partsOfProductToUpdate.image.url}',
            alt = '${partsOfProductToUpdate.image.alt}'
        WHERE id = '${imageId[0].image}'
        `);
  }

  const product = await getProductByIdDal(id);

  return product;
};

export const deleteProductByIdDal = async (id: string) => {
  const { rows: imageId }: any = await query(
    `select image from products where id = '${id}'`
  );
  const { rows }: any =
    await query(`delete from product_coordinates where product = '${id}';
    delete from product_tags where product = '${id}';
    delete from products where id = '${id}' returning * ;`);
  await query(`delete from images where id = '${imageId[0].image}'`);
};

const adminProducts: AdminProduct[] = [
  {
    id: '1',
    name: 'Product 1',
    saleprice: 50,
    quantity: 10,
    description: 'This is product 1 description.',
    category: 'Electronics',
    discount: 10,
    rating: 4.5,
    clicked: 100,
    image: { url: 'image1.jpg', alt: 'Product 1 Image' },
    coordinate: { longitude: 34.789, latitude: -123.456 },
    tags: { tag1: 'value1', tag2: 'value2' },
    isForSale: true,
    costPrice: 30,
    supplier: 'Supplier 1',
  },
  {
    id: '2',
    name: 'Product 2',
    saleprice: 75,
    quantity: 20,
    description: 'This is product 2 description.',
    category: 'Clothing',
    discount: 15,
    rating: 4.2,
    clicked: 150,
    image: { url: 'image2.jpg', alt: 'Product 2 Image' },
    coordinate: { longitude: 34.567, latitude: -123.789 },
    tags: { tag3: 'value3', tag4: 'value4' },
    isForSale: true,
    costPrice: 50,
    supplier: 'Supplier 2',
  },
  {
    id: '3',
    name: 'Product 3',
    saleprice: 90,
    quantity: 15,
    description: 'This is product 3 description.',
    category: 'Home and Kitchen',
    discount: 20,
    rating: 4.8,
    clicked: 200,
    image: { url: 'image3.jpg', alt: 'Product 3 Image' },
    coordinate: { longitude: 34.123, latitude: -123.987 },
    tags: { tag5: 'value5', tag6: 'value6' },
    isForSale: true,
    costPrice: 70,
    supplier: 'Supplier 3',
  },
];

const selectAll =
  'SELECT p.id, p.name, p.price AS salePrice, p.quantity, p.description, c.name AS category, p.discount AS discountPercentage, p.rating, p.clicked AS click, i.url AS image_url, i.alt AS image_alt, c2.lng AS longitude, c2.lat AS latitude, jsonb_object_agg(t.name, tv.name) AS tags, p.isForSale, p.costPrice, p.supplier FROM products p JOIN categories c ON p.category = c.id JOIN images i ON p.image = i.id JOIN product_coordinates pc ON p.id = pc.product JOIN coordinates c2 ON pc.coordinates = c2.id LEFT JOIN product_tags pt ON p.id = pt.product LEFT JOIN tag_values tv ON pt.tag_and_value_id = tv.id LEFT JOIN tags t ON tv.tag = t.id GROUP BY p.id, c.name, i.url, i.alt, c2.lng, c2.lat ;';
