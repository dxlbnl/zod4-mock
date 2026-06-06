<script lang="ts">
	// B103 — Key-Based Field Heuristics, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/key-heuristics.md (the §6 hand-authored
	// convention; parity is human-policed). docs/key-heuristics.md stays canonical.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import Playground from '$lib/docs/widgets/Playground.svelte';

	// A bare z.object(...) expression — the SchemaPlayground DEFAULT_CODE contract
	// (a single valid expression buildExecutable evaluates and auto-generates from).
	const explainCode = `z.object({
  id: z.string(),
  firstName: z.string(),
  email: z.string(),
  homeAddress: z.string(),
  kind: z.string(),
})`;
</script>

<DocPage title="Key Heuristics" sidebarGroup="reference" order={2}>
	<p>
		The key-based generator fires <strong>after matchers and per-schema <code>withKeyMap</code> /
		world-level <code>withGenerators</code>, and before schema-based generation</strong>. It
		inspects the field name and, when it recognises the pattern, produces a semantically meaningful
		value — no matcher required.
	</p>

	<p>
		This page lists every exact-key entry, every pattern rule, and the Dutch-language aliases that
		ship in <code>src/generators/data/key-map.ts</code>. Use <code>world.explain(schema)</code> to
		inspect what the engine would pick for any given schema.
	</p>

	<hr />

	<h2>How it works</h2>
	<p>The library calls <code>generateFromKey(key, schema, ctx)</code>:</p>
	<ol>
		<li>
			The field name is <strong>lowercased</strong> for matching (case-insensitive —
			<code>CreatedAt</code>, <code>created_at</code>, <code>CREATEDAT</code> all match the same rule).
		</li>
		<li>
			The Zod schema is unwrapped to its <strong>leaf type</strong> (<code>string</code>,
			<code>number</code>, <code>date</code>, …) — <code>getLeafDef(schema)</code> strips
			<code>optional</code>, <code>nullable</code>, <code>default</code>, <code>readonly</code>,
			<code>catch</code>, <code>brand</code>.
		</li>
		<li>
			<code>DEFAULT_KEY_MAP[leafType][lowercasedKey]</code> is consulted first. If an
			<strong>exact-key entry</strong> exists, it wins.
		</li>
		<li>
			Otherwise the rules in <code>DEFAULT_KEY_PATTERNS[leafType]</code> are tried in order; the
			<strong>first matching pattern</strong> wins.
		</li>
		<li>
			If neither table matches, the key-based generator returns <code>undefined</code> and the engine
			falls through to schema-based generation.
		</li>
	</ol>

	<p>
		Many rules are <strong>schema-type-gated</strong>: a key like <code>email</code> only matches when
		the field is <code>z.string()</code>. A field named <code>email: z.number()</code> falls through
		to schema-based generation (no exact-key fire from <code>DEFAULT_KEY_MAP.string</code>).
	</p>

	<p>The full resolution order in <code>WorldImpl.generateObjectFields</code> is:</p>

	<table>
		<thead>
			<tr>
				<th>Step</th>
				<th>Identifier in <code>world.explain</code> output</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>1. Matcher registered via <code>world.withSchema(...)</code></td>
				<td><code>matcher:&lt;key&gt;</code></td>
			</tr>
			<tr>
				<td>2. Per-schema key map registered via <code>world.withKeyMap(...)</code></td>
				<td><code>key-map:&lt;key&gt;</code></td>
			</tr>
			<tr>
				<td>3. Custom world-level generator registered via <code>world.withGenerators(...)</code></td>
				<td><code>custom:&lt;key&gt;</code></td>
			</tr>
			<tr>
				<td>4. <strong>Exact-key</strong> entry in <code>DEFAULT_KEY_MAP</code></td>
				<td><code>&lt;namespace&gt;.&lt;fn&gt;</code> (e.g. <code>person.firstName</code>)</td>
			</tr>
			<tr>
				<td>5. <strong>Pattern</strong> match in <code>DEFAULT_KEY_PATTERNS</code></td>
				<td><code>&lt;namespace&gt;.&lt;fn&gt;</code> plus a leaf-type suffix for dates</td>
			</tr>
			<tr>
				<td>6. Schema-based fallback (Zod-introspection)</td>
				<td><code>schema-based</code></td>
			</tr>
		</tbody>
	</table>

	<hr />

	<h2>Exact-key generators (string)</h2>
	<p>
		These fire when the field is a <code>z.string()</code> (or unwrapped to one) and the lowercased
		field name <strong>exactly matches</strong> the key.
	</p>

	<h3>Person</h3>
	<table>
		<thead>
			<tr><th>Key (case-insensitive)</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>firstname</code>, <code>first_name</code></td><td><code>person.firstName</code></td><td>First name</td></tr>
			<tr><td><code>lastname</code>, <code>last_name</code>, <code>surname</code></td><td><code>person.lastName</code></td><td>Last name</td></tr>
			<tr><td><code>middlename</code>, <code>middle_name</code></td><td><code>person.middleName</code></td><td>Middle name</td></tr>
			<tr><td><code>fullname</code>, <code>full_name</code>, <code>name</code></td><td><code>person.fullName</code></td><td>Full name</td></tr>
			<tr><td><code>prefix</code></td><td><code>person.prefix</code></td><td>Honorific prefix (Mr., Dr., …)</td></tr>
			<tr><td><code>suffix</code></td><td><code>person.suffix</code></td><td>Name suffix (Jr., III, …)</td></tr>
			<tr><td><code>bio</code></td><td><code>inline:bio</code></td><td>Lorem text (respects <code>.min()</code>/<code>.max()</code>)</td></tr>
			<tr><td><code>gender</code></td><td><code>person.gender</code></td><td>A gender label</td></tr>
			<tr><td><code>sex</code></td><td><code>person.sex</code></td><td>A sex label</td></tr>
			<tr><td><code>jobtitle</code>, <code>job_title</code></td><td><code>person.jobTitle</code></td><td>Job title</td></tr>
			<tr><td><code>jobarea</code>, <code>job_area</code></td><td><code>person.jobArea</code></td><td>Job area</td></tr>
			<tr><td><code>jobtype</code>, <code>job_type</code></td><td><code>person.jobType</code></td><td>Job type</td></tr>
		</tbody>
	</table>

	<h3>Internet</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>email</code></td><td><code>internet.email</code></td><td>Realistic email</td></tr>
			<tr><td><code>example_email</code></td><td><code>internet.exampleEmail</code></td><td><code>@example.com</code> email</td></tr>
			<tr><td><code>username</code></td><td><code>internet.username</code></td><td>Username</td></tr>
			<tr><td><code>displayname</code>, <code>display_name</code></td><td><code>internet.displayName</code></td><td>Display name</td></tr>
			<tr><td><code>password</code></td><td><code>inline:password</code></td><td>16-character nanoid</td></tr>
			<tr><td><code>url</code>, <code>website</code>, <code>homepage</code></td><td><code>internet.url</code></td><td>HTTPS URL</td></tr>
			<tr><td><code>ip</code></td><td><code>internet.ip</code></td><td>IPv4 or IPv6 address</td></tr>
			<tr><td><code>ipv4</code></td><td><code>internet.ipv4</code></td><td>IPv4 address</td></tr>
			<tr><td><code>ipv6</code></td><td><code>internet.ipv6</code></td><td>IPv6 address</td></tr>
			<tr><td><code>mac</code></td><td><code>internet.mac</code></td><td>MAC address</td></tr>
			<tr><td><code>useragent</code>, <code>user_agent</code></td><td><code>internet.userAgent</code></td><td>User-Agent string</td></tr>
			<tr><td><code>protocol</code></td><td><code>internet.protocol</code></td><td><code>http</code> / <code>https</code></td></tr>
			<tr><td><code>domain</code>, <code>domainname</code>, <code>domain_name</code></td><td><code>internet.domainName</code></td><td>Domain name</td></tr>
		</tbody>
	</table>

	<h3>Location</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>city</code></td><td><code>location.city</code></td><td>City name</td></tr>
			<tr><td><code>country</code></td><td><code>location.country</code></td><td>Country name</td></tr>
			<tr><td><code>countrycode</code>, <code>country_code</code></td><td><code>location.countryCode</code></td><td>ISO country code</td></tr>
			<tr><td><code>street</code>, <code>streetname</code>, <code>street_name</code></td><td><code>location.street</code></td><td>Street name</td></tr>
			<tr><td><code>address</code>, <code>streetaddress</code>, <code>street_address</code></td><td><code>location.streetAddress</code></td><td>Full street address</td></tr>
			<tr><td><code>zipcode</code>, <code>postalcode</code>, <code>postal_code</code>, <code>postcode</code></td><td><code>location.zipCode</code></td><td>Postal code</td></tr>
			<tr><td><code>state</code></td><td><code>location.state</code></td><td>State or region</td></tr>
			<tr><td><code>county</code></td><td><code>location.county</code></td><td>County</td></tr>
			<tr><td><code>timezone</code>, <code>time_zone</code></td><td><code>location.timeZone</code></td><td>IANA time zone</td></tr>
		</tbody>
	</table>

	<h3>Finance</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>iban</code></td><td><code>finance.iban</code></td><td>IBAN</td></tr>
			<tr><td><code>bic</code></td><td><code>finance.bic</code></td><td>BIC / SWIFT code</td></tr>
			<tr><td><code>accountnumber</code>, <code>account_number</code></td><td><code>inline:accountnumber</code></td><td>Bank account number (respects <code>.min()</code>)</td></tr>
			<tr><td><code>creditcard</code>, <code>credit_card</code>, <code>creditcardnumber</code>, <code>credit_card_number</code></td><td><code>inline:creditcard</code> (and aliases)</td><td>Credit-card number</td></tr>
			<tr><td><code>currency</code>, <code>currencycode</code>, <code>currency_code</code></td><td><code>finance.currencyCode</code></td><td>ISO currency code</td></tr>
			<tr><td><code>bitcoin</code></td><td><code>finance.bitcoinAddress</code></td><td>Bitcoin address</td></tr>
			<tr><td><code>ethereum</code></td><td><code>finance.ethereumAddress</code></td><td>Ethereum address</td></tr>
		</tbody>
	</table>

	<h3>Commerce</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>product</code></td><td><code>commerce.product</code></td><td>Product noun</td></tr>
			<tr><td><code>productname</code>, <code>product_name</code></td><td><code>commerce.productName</code></td><td>Product name</td></tr>
			<tr><td><code>isbn</code></td><td><code>commerce.isbn</code></td><td>ISBN</td></tr>
			<tr><td><code>upc</code></td><td><code>commerce.upc</code></td><td>UPC</td></tr>
			<tr><td><code>department</code></td><td><code>commerce.department</code></td><td>Retail department</td></tr>
			<tr><td><code>material</code></td><td><code>commerce.productMaterial</code></td><td>Product material</td></tr>
			<tr><td><code>price</code></td><td><code>inline:price</code></td><td>Price string (respects <code>.min()</code>/<code>.max()</code>)</td></tr>
			<tr><td><code>sku</code></td><td><code>inline:sku</code></td><td>Code like <code>AB-1234</code></td></tr>
		</tbody>
	</table>

	<h3>Company</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>company</code>, <code>companyname</code>, <code>company_name</code></td><td><code>company.name</code></td><td>Company name</td></tr>
			<tr><td><code>buzzword</code></td><td><code>company.buzzPhrase</code></td><td>Business buzzphrase</td></tr>
			<tr><td><code>catchphrase</code></td><td><code>company.catchPhrase</code></td><td>Marketing catchphrase</td></tr>
		</tbody>
	</table>

	<h3>Phone</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>phone</code>, <code>phonenumber</code>, <code>phone_number</code></td><td><code>phone.number</code></td><td>Phone number with country code</td></tr>
			<tr><td><code>imei</code></td><td><code>phone.imei</code></td><td>IMEI</td></tr>
		</tbody>
	</table>

	<h3>Vehicle</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>vin</code></td><td><code>vehicle.vin</code></td><td>Vehicle Identification Number</td></tr>
			<tr><td><code>vrm</code></td><td><code>vehicle.vrm</code></td><td>Vehicle Registration Mark (license plate)</td></tr>
			<tr><td><code>vehicle</code></td><td><code>vehicle.vehicle</code></td><td>Vehicle make + model</td></tr>
			<tr><td><code>manufacturer</code></td><td><code>vehicle.manufacturer</code></td><td>Vehicle manufacturer</td></tr>
			<tr><td><code>model</code></td><td><code>vehicle.model</code></td><td>Vehicle model</td></tr>
			<tr><td><code>vehiclecolor</code>, <code>vehicle_color</code></td><td><code>vehicle.color</code></td><td>Vehicle color</td></tr>
			<tr><td><code>fuel</code></td><td><code>vehicle.fuel</code></td><td>Fuel type</td></tr>
		</tbody>
	</table>

	<h3>Color (CSS / UI)</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>color</code>, <code>colour</code></td><td><code>color.colorName</code></td><td>Color name</td></tr>
			<tr><td><code>colorhex</code>, <code>color_hex</code>, <code>hexcolor</code>, <code>hex_color</code></td><td><code>color.colorHex</code></td><td>Hex color (e.g. <code>#a1b2c3</code>)</td></tr>
			<tr><td><code>backgroundcolor</code>, <code>background_color</code>, <code>textcolor</code>, <code>text_color</code></td><td><code>color.colorHex</code></td><td>Hex color</td></tr>
		</tbody>
	</table>

	<h3>System</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>platform</code>, <code>os</code>, <code>operatingsystem</code>, <code>operating_system</code></td><td><code>system.platform</code></td><td>Operating system</td></tr>
			<tr><td><code>browser</code></td><td><code>system.browser</code></td><td>Browser name</td></tr>
			<tr><td><code>semver</code>, <code>version</code></td><td><code>system.semver</code></td><td>Semver string</td></tr>
			<tr><td><code>filename</code>, <code>file_name</code></td><td><code>system.fileName</code></td><td>File name</td></tr>
			<tr><td><code>filepath</code>, <code>file_path</code></td><td><code>system.filePath</code></td><td>File path</td></tr>
			<tr><td><code>extension</code>, <code>fileextension</code>, <code>file_extension</code></td><td><code>system.fileExtension</code></td><td>File extension</td></tr>
			<tr><td><code>mimetype</code>, <code>mime_type</code>, <code>contenttype</code>, <code>content_type</code></td><td><code>system.mimeType</code></td><td>MIME type</td></tr>
		</tbody>
	</table>

	<h3>Word &amp; free text</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>word</code></td><td><code>word.noun</code></td><td>A single noun</td></tr>
			<tr><td><code>text</code>, <code>description</code>, <code>note</code>, <code>summary</code>, <code>comment</code>, <code>body</code>, <code>content</code>, <code>message</code></td><td><code>inline:&lt;key&gt;</code></td><td>Lorem text (respects <code>.min()</code>/<code>.max()</code>)</td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Exact-key generators (number)</h2>
	<p>These fire when the field is a <code>z.number()</code> (or unwrapped to one).</p>

	<table>
		<thead>
			<tr><th>Key</th><th>Distribution</th><th>Generator identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>amount</code>, <code>bedrag</code></td><td>log-uniform</td><td><code>inline:amount</code></td><td>Currency amount, Benford-conforming (<code>.min()</code>/<code>.max()</code>, default 1 – 10 000)</td></tr>
			<tr><td><code>price</code>, <code>prijs</code></td><td>log-uniform</td><td><code>inline:price</code></td><td>Price amount, Benford-conforming (<code>.min()</code>/<code>.max()</code>, default 1 – 500)</td></tr>
			<tr><td><code>balance</code></td><td>log-uniform</td><td><code>inline:balance</code></td><td>Money balance (default 1 – 100 000)</td></tr>
			<tr><td><code>total</code>, <code>subtotal</code></td><td>log-uniform</td><td><code>inline:total</code></td><td>Order total / subtotal (default 1 – 10 000)</td></tr>
			<tr><td><code>revenue</code></td><td>log-uniform</td><td><code>inline:revenue</code></td><td>Revenue figure (default 1 000 – 1 × 10⁹)</td></tr>
			<tr><td><code>cost</code>, <code>fee</code></td><td>log-uniform</td><td><code>inline:cost</code></td><td>Cost / fee amount (default 1 – 1 000)</td></tr>
			<tr><td><code>salary</code></td><td>log-uniform</td><td><code>inline:salary</code></td><td>Annual salary (default 20 000 – 500 000)</td></tr>
			<tr><td><code>fileSize</code>, <code>bytes</code></td><td>log-uniform-int</td><td><code>inline:fileSize</code></td><td>Scale-free byte count (default 100 – 1 × 10⁹)</td></tr>
			<tr><td><code>views</code>, <code>population</code></td><td>log-uniform-int</td><td><code>inline:views</code></td><td>Scale-free count (default 1 – 1 × 10⁷)</td></tr>
			<tr><td><code>distance</code></td><td>log-uniform</td><td><code>inline:distance</code></td><td>Continuous distance (default 1 – 10 000)</td></tr>
			<tr><td><code>rating</code></td><td>uniform</td><td><code>inline:rating</code></td><td>Bounded score on <code>[0, 5]</code></td></tr>
			<tr><td><code>score</code>, <code>percentage</code></td><td>uniform</td><td><code>inline:score</code></td><td>Bounded score on <code>[0, 100]</code></td></tr>
			<tr><td><code>latitude</code></td><td>uniform</td><td><code>location.latitude</code></td><td>Latitude in degrees</td></tr>
			<tr><td><code>longitude</code></td><td>uniform</td><td><code>location.longitude</code></td><td>Longitude in degrees</td></tr>
			<tr><td><code>port</code></td><td>uniform</td><td><code>internet.port</code></td><td>TCP/UDP port number</td></tr>
			<tr><td><code>quantity</code></td><td>geometric</td><td><code>inline:quantity</code></td><td>Truncated geometric (<code>p = 0.5</code>), modal at lower bound (default <code>[1, 100]</code>)</td></tr>
			<tr><td><code>count</code></td><td>geometric</td><td><code>inline:count</code></td><td>Truncated geometric (<code>p = 0.5</code>), modal at lower bound; <code>min = 0</code> native (default <code>[0, 50]</code>)</td></tr>
			<tr><td><code>age</code></td><td>log-normal</td><td><code>inline:age</code></td><td>Clipped log-normal centred on μ = ln(36), σ = 0.35 (default <code>[18, 80]</code>); tight bounds → uniform-int</td></tr>
			<tr><td><code>year</code></td><td>exponential</td><td><code>inline:year</code></td><td>Exponential recent-skew (λ = 0.05); default <code>[currentYear - 50, currentYear]</code>; tight → uniform-int</td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Pattern generators</h2>
	<p>
		When an exact-key entry does not match, the engine tries pattern rules. Each rule has a
		<code>test(lowercasedKey)</code> function; the <strong>first match wins</strong>.
	</p>

	<h3>Pattern generators (string)</h3>
	<table>
		<thead>
			<tr><th>Match</th><th>Identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td>Exactly <code>id</code>, or <strong>ends with</strong> <code>id</code>, <code>uuid</code>, <code>guid</code></td><td><code>string.uuid</code></td><td>UUID (RFC 4122 v4)</td></tr>
			<tr><td><strong>Ends with</strong> <code>name</code></td><td><code>person.fullName</code></td><td>Full name</td></tr>
			<tr><td><strong>Ends with</strong> <code>url</code>, <code>link</code>, or <strong>starts with</strong> <code>url</code></td><td><code>internet.url</code></td><td>HTTPS URL</td></tr>
			<tr><td><strong>Ends with</strong> <code>email</code></td><td><code>internet.email</code></td><td>Realistic email</td></tr>
			<tr><td><strong>Ends with</strong> <code>at</code>, <code>date</code>, <strong>starts with</strong> <code>date</code>, or <strong>ends with</strong> <code>_on</code> (excluding <code>position</code>)</td><td><code>date.anytime+toISOString</code></td><td>ISO 8601 date string</td></tr>
		</tbody>
	</table>

	<h3>Pattern generators (date)</h3>
	<p>
		When the field is a <code>z.date()</code> (or coerced/unwrapped to one), the date pattern produces
		a <code>Date</code> object.
	</p>
	<table>
		<thead>
			<tr><th>Match</th><th>Identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><strong>Ends with</strong> <code>at</code>, <code>date</code>, <strong>starts with</strong> <code>date</code>, or <strong>ends with</strong> <code>_on</code> (excluding <code>position</code>)</td><td><code>date.anytime</code></td><td>A <code>Date</code> instance</td></tr>
		</tbody>
	</table>

	<h3>Pattern generators (number)</h3>
	<p>
		When the field is a <code>z.number()</code>, the date pattern produces a Unix timestamp in
		milliseconds.
	</p>
	<table>
		<thead>
			<tr><th>Match</th><th>Identifier</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><strong>Ends with</strong> <code>at</code>, <code>date</code>, <strong>starts with</strong> <code>date</code>, or <strong>ends with</strong> <code>_on</code> (excluding <code>position</code>)</td><td><code>date.anytime+getTime</code></td><td>Unix-ms timestamp</td></tr>
		</tbody>
	</table>

	<p>
		The same key with a different Zod type yields a different output: <code>createdAt: z.string()</code>
		→ ISO string; <code>createdAt: z.date()</code> → <code>Date</code>; <code>createdAt: z.number()</code>
		→ ms timestamp.
	</p>

	<hr />

	<h2>Localised aliases</h2>
	<p>
		The Dutch-language keys live in <code>DEFAULT_KEY_MAP</code> <strong>itself</strong> — they are
		not provided by the locale packages. The locale packages (<code>@zod4-mock/locale-en</code>,
		<code>@zod4-mock/locale-nl</code>, <code>@zod4-mock/locale-names</code>) supply
		<code>LocaleData</code> (vocabulary, formatters, Markov models), not key maps. Adding a new locale
		does <strong>not</strong> add new key aliases; those changes happen in
		<code>src/generators/data/key-map.ts</code>.
	</p>
	<p>The Dutch aliases that ship today:</p>

	<h3>Strings</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Maps to</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>voornaam</code></td><td><code>person.firstName</code></td><td>First name</td></tr>
			<tr><td><code>achternaam</code></td><td><code>person.lastName</code></td><td>Last name</td></tr>
			<tr><td><code>straat</code></td><td><code>location.street</code></td><td>Street name</td></tr>
			<tr><td><code>stad</code></td><td><code>location.city</code></td><td>City</td></tr>
			<tr><td><code>land</code></td><td><code>location.country</code></td><td>Country</td></tr>
			<tr><td><code>kenteken</code></td><td><code>vehicle.vrm</code></td><td>License plate (VRM)</td></tr>
			<tr><td><code>voertuigkleur</code></td><td><code>vehicle.color</code></td><td>Vehicle color</td></tr>
			<tr><td><code>kleur</code></td><td><code>color.colorName</code></td><td>Color name</td></tr>
			<tr><td><code>telefoon</code></td><td><code>phone.number</code></td><td>Phone number</td></tr>
			<tr><td><code>prijs</code></td><td><code>inline:prijs</code></td><td>Price string (respects <code>.min()</code>/<code>.max()</code>)</td></tr>
			<tr><td><code>omschrijving</code></td><td><code>inline:omschrijving</code></td><td>Description (lorem text, length-aware)</td></tr>
			<tr><td><code>bericht</code></td><td><code>inline:bericht</code></td><td>Message (lorem text, length-aware)</td></tr>
		</tbody>
	</table>

	<h3>Numbers</h3>
	<table>
		<thead>
			<tr><th>Key</th><th>Maps to</th><th>Description</th></tr>
		</thead>
		<tbody>
			<tr><td><code>bedrag</code></td><td><code>inline:bedrag</code></td><td>Amount (respects <code>.min()</code>/<code>.max()</code>, default 1 – 10 000)</td></tr>
			<tr><td><code>prijs</code></td><td><code>inline:prijs</code></td><td>Price (respects <code>.min()</code>/<code>.max()</code>, default 1 – 500)</td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Using <code>world.explain</code> to debug a schema</h2>
	<p>
		<code>world.explain(schema)</code> reports — for each top-level field — which row of this table
		the engine would pick. It is read-only and PRNG-neutral, so it never disturbs the next
		<code>generate</code> call. See <a href="/docs/api">world.explain in the API Reference</a> for the
		full type.
	</p>

	<p>
		Try the schema below in the playground — every field resolves through the heuristics above
		(<code>firstName</code> → a first name, <code>email</code> → an email, <code>id</code> → a UUID),
		while <code>homeAddress</code> matches no rule and falls through to schema-based generation:
	</p>

	<Playground initialCode={explainCode} />

	<pre><code>{`const UserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  email: z.string(),
  homeAddress: z.string(), // ← does NOT match any exact key
  kind: z.string(),
});

const world = createWorld({ seed: 1 }).withSchema(UserSchema, {
  matchers: { kind: () => "admin" },
});

console.log(world.explain(UserSchema).toString());
// id          → string.uuid      (key-pattern: ends with "id")
// firstName   → person.firstName (exact key: "firstname")
// email       → internet.email   (exact key: "email")
// homeAddress → schema-based     (no key match, no matcher)
// kind        → matcher:kind     (matcher registered via withSchema)`}</code></pre>

	<p>
		The <code>homeAddress</code> line is the <strong>near-miss diagnostic</strong>: the field name
		didn't match any rule, so a random schema-based string will be produced. Renaming it to
		<code>address</code>, or registering a matcher, attaches a realistic generator.
	</p>

	<hr />

	<h2>Overriding a built-in heuristic</h2>
	<p>
		<strong>Option A — Matcher in <code>withSchema</code></strong> (field-specific, highest priority):
	</p>
	<pre><code>{`world.withSchema(OrderSchema, {
  matchers: {
    email: (ctx) => \`orders+\${ctx.gen.string.uuid()}@mycompany.com\`,
  },
});`}</code></pre>

	<p><strong>Option B — <code>world.withGenerators</code></strong> (world-wide, overrides built-ins):</p>
	<pre><code>{`world.withGenerators({
  email: (_schema, ctx) => \`user\${ctx.prng.int(1, 999)}@internal.example.com\`,
});`}</code></pre>

	<p>
		Custom generators registered via <code>withGenerators</code> or <code>WorldOptions.generators</code>
		take priority over the built-in heuristics. Keys are matched case-insensitively.
	</p>

	<hr />

	<h2>Adding domain-specific generators</h2>
	<pre><code>{`const world = createWorld({
  seed: 42,
  generators: {
    durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
    vendorCode: (_schema, ctx) => \`V-\${ctx.prng.int(1000, 9999)}\`,
  },
});`}</code></pre>

	<p>
		Or additively via <code>world.withGenerators({'{...}'})</code>. See <code>KeyGenerator</code> for
		the signature.
	</p>

	<hr />

	<h2>Important notes</h2>
	<ul>
		<li>
			<strong>Field names are matched after lowercasing.</strong> Original casing is irrelevant.
		</li>
		<li>
			<strong>Date heuristics are type-aware.</strong> A field named <code>createdAt</code> produces a
			<code>Date</code>, an ISO string, or a numeric timestamp depending on the Zod schema.
		</li>
		<li>
			<strong>Other heuristics are schema-type-gated.</strong> <code>quantity</code>, <code>count</code>,
			etc. only fire for <code>z.number()</code>; a <code>z.string()</code> field named
			<code>quantity</code> falls through to schema-based generation.
		</li>
		<li>
			<strong>Custom generators take priority.</strong> Anything registered via
			<code>WorldOptions.generators</code> or <code>world.withGenerators(...)</code> overrides the
			built-in table.
		</li>
		<li>
			<strong><code>inline:&lt;key&gt;</code> identifiers</strong> indicate a length-aware or composite
			inline closure in <code>DEFAULT_KEY_MAP</code> (e.g. <code>bio</code>, <code>description</code>,
			<code>sku</code>, <code>accountnumber</code>). The behaviour is documented in the description
			column.
		</li>
	</ul>
</DocPage>
