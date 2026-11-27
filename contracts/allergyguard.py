# v0.1.1
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class AllergyGuard(gl.Contract):

    check_count: u256
    last_result: str

    def __init__(self):
        self.check_count = 0
        self.last_result = ""

    @gl.public.write
    def check_food(
        self,
        food_name: str,
        allergy_names: list[str]
    ) -> str:

        food = food_name.strip()
        allergies = sorted(set(
            item.strip() for item in allergy_names if item.strip()
        ))

        if not food:
            raise gl.vm.UserError("Food name is required.")

        if len(food) > 120:
            raise gl.vm.UserError("Food name is too long.")

        if not allergies:
            raise gl.vm.UserError("Add at least one food allergy.")

        if len(allergies) > 30:
            raise gl.vm.UserError("Too many allergies.")

        if any(len(item) > 80 for item in allergies):
            raise gl.vm.UserError("An allergy name is too long.")

        def research_and_assess():

            query = (
                food.replace(" ", "+")
                .replace("&", "%26")
                .replace("?", "%3F")
                .replace("#", "%23")
            ) + "+ingredients+recipe"

            research = ""
            working_source = ""

            # Try each source in order.
            # Move to the next source if a request fails,
            # returns no useful content, or is blocked.

            sources = [
                (
                    "TheMealDB",
                    "https://www.themealdb.com/api/json/v1/1/search.php?s="
                    + food.replace(" ", "%20")
                ),
                (
                    "Bing RSS",
                    "https://www.bing.com/search?format=rss&q=" + query
                ),
                (
                    "Wikipedia API",
                    "https://en.wikipedia.org/w/api.php?action=query"
                    "&list=search&srsearch=" + query
                    + "&format=json"
                ),
                (
                    "Google",
                    "https://www.google.com/search?q=" + query
                ),
                (
                    "Brave Search",
                    "https://search.brave.com/search?q=" + query
                ),
                (
                    "Ecosia",
                    "https://www.ecosia.org/search?q=" + query
                ),
                (
                    "Mojeek",
                    "https://www.mojeek.com/search?q=" + query
                )
            ]

            blocked_terms = [
                "captcha",
                "verify you are human",
                "bot verification",
                "unusual traffic",
                "automated queries",
                "access denied",
                "cloudflare",
                "robot check"
            ]

            for source_name, source_url in sources:

                try:
                    response = gl.nondet.web.get(source_url)

                    if response.status != 200:
                        continue

                    if response.body is None:
                        continue

                    page = response.body.decode("utf-8")

                    if not page or len(page.strip()) < 100:
                        continue

                    lower_page = page.lower()

                    if any(
                        term in lower_page
                        for term in blocked_terms
                    ):
                        continue

                    # TheMealDB returns structured recipe data.
                    if source_name == "TheMealDB":

                        try:
                            data = json.loads(page)
                        except Exception:
                            continue

                        meals = data.get("meals")

                        if not isinstance(meals, list) or not meals:
                            continue

                        meal_information = []

                        for meal in meals[:3]:

                            ingredients = []

                            for i in range(1, 21):

                                ingredient = str(
                                    meal.get(
                                        "strIngredient" + str(i), ""
                                    ) or ""
                                ).strip()

                                measure = str(
                                    meal.get(
                                        "strMeasure" + str(i), ""
                                    ) or ""
                                ).strip()

                                if ingredient:
                                    ingredients.append(
                                        measure + " " + ingredient
                                    )

                            if ingredients:
                                meal_information.append({
                                    "meal": meal.get("strMeal", ""),
                                    "ingredients": ingredients,
                                    "instructions": str(
                                        meal.get("strInstructions", "")
                                    )[:1500],
                                    "recipe_source": meal.get(
                                        "strSource", ""
                                    ),
                                    "api_source": source_url
                                })

                        if not meal_information:
                            continue

                        research = json.dumps(meal_information)
                        working_source = source_name
                        break

                    # Wikipedia API returns structured search results.
                    if source_name == "Wikipedia API":

                        try:
                            data = json.loads(page)
                            results = data.get(
                                "query", {}
                            ).get("search", [])
                        except Exception:
                            continue

                        if not results:
                            continue

                        research = json.dumps({
                            "source": source_name,
                            "results": results[:5],
                            "source_url": source_url
                        })

                        working_source = source_name
                        break

                    # Search engine results must contain actual content.
                    if len(page.strip()) < 250:
                        continue

                    research = page[:12000]
                    working_source = source_name
                    break

                except Exception:
                    continue

            # No usable source was found.
            if not research:

                return {
                    "risk_level": "INSUFFICIENT_INFORMATION",
                    "ingredients": [],
                    "matched_allergens": [],
                    "uncertain_matches": [],
                    "explanation": (
                        "The available research sources could not "
                        "provide usable ingredient information for "
                        "this food."
                    ),
                    "sources": [],
                    "research_source": "None"
                }

            
            prompt = f"""
You are the food research and allergy assessment engine
for AllergyGuard.

Investigate the food and assess its ingredients against
the person's declared food allergies.

FOOD:
{food}

DECLARED ALLERGIES:
{json.dumps(allergies)}

RESEARCH SOURCE:
{working_source}

RESEARCH DATA:
{research[:12000]}

INSTRUCTIONS:

1. Identify ingredients explicitly supported by the research.

2. Consider common recipe variations only when they are
   supported by the supplied research.

3. Do not assume every recipe or variation uses the same
   ingredients.

4. Do not invent ingredients, sources, recipes, or URLs.

5. Identify ingredients that directly contain, are derived
   from, or may correspond to a declared allergy.

6. Separate confirmed allergen matches from uncertain
   ingredient matches.

7. Assess only the food's ingredients and recipe variations.
   Do not discuss cross-contamination, food preparation
   equipment, kitchen hygiene, restaurant handling, or
   unrelated safety factors.

8. If the research does not provide enough reliable
   ingredient information, use INSUFFICIENT_INFORMATION.

9. HIGH_RISK means one or more declared allergens are
   identified as ingredients in the researched recipes.

10. POTENTIAL_RISK means an ingredient may contain or be
    derived from a declared allergen, but the match is
    uncertain.

11. NO_IDENTIFIED_RISK means no declared allergen was
    identified in the available ingredient evidence.
    This is not a guarantee that the food is safe.

12. Explain the result in plain language. Do not make
    claims about all possible versions of a food unless
    the research actually supports that conclusion.

13. Include only source URLs actually present in the
    supplied research.

Return ONLY a JSON object with these fields:

{{
  "risk_level": "HIGH_RISK | POTENTIAL_RISK | INSUFFICIENT_INFORMATION | NO_IDENTIFIED_RISK",
  "ingredients": ["ingredient 1"],
  "matched_allergens": ["allergy name"],
  "uncertain_matches": ["possible match"],
  "explanation": "brief explanation",
  "sources": [
    {{
      "title": "source title",
      "url": "actual source URL"
    }}
  ]
}}

Do not include markdown or additional text.
"""


            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json"
            )

            if not isinstance(result, dict):
                return {
                    "risk_level": "INSUFFICIENT_INFORMATION",
                    "ingredients": [],
                    "matched_allergens": [],
                    "uncertain_matches": [],
                    "explanation": (
                        "The research could not be converted into "
                        "a reliable assessment."
                    ),
                    "sources": [],
                    "research_source": working_source
                }

            result["research_source"] = working_source

            return result

        def validator_fn(leader_result):

            if not isinstance(leader_result, gl.vm.Return):
                return False

            leader_data = leader_result.calldata

            if not isinstance(leader_data, dict):
                return False

            own_data = research_and_assess()

            if not isinstance(own_data, dict):
                return False

            leader_matches = sorted(
                str(x).lower()
                for x in leader_data.get("matched_allergens", [])
            )

            own_matches = sorted(
                str(x).lower()
                for x in own_data.get("matched_allergens", [])
            )

            leader_uncertain = sorted(
                str(x).lower()
                for x in leader_data.get("uncertain_matches", [])
            )

            own_uncertain = sorted(
                str(x).lower()
                for x in own_data.get("uncertain_matches", [])
            )

            return (
                leader_data.get("risk_level")
                == own_data.get("risk_level")
                and leader_matches == own_matches
                and leader_uncertain == own_uncertain
            )

        result = gl.vm.run_nondet_unsafe(
            research_and_assess,
            validator_fn
        )

        if not isinstance(result, dict):
            raise gl.vm.UserError(
                "The allergy assessment could not be completed."
            )

        self.check_count += 1

        result["check_id"] = self.check_count
        result["food_name"] = food
        result["allergies_checked"] = allergies

        self.last_result = json.dumps(
            result,
            sort_keys=True
        )

        return self.last_result

    @gl.public.view
    def get_last_result(self) -> str:
        return self.last_result

    @gl.public.view
    def get_check_count(self) -> u256:
        return self.check_count
