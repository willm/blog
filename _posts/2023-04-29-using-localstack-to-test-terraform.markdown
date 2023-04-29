---
layout: post
title:  "Using localstack to test terraform"
date:   2023-04-29 08:00:00 +0000
categories: terraform aws devops lambda ioc localstack
---

I recently experimented with running an AWS application completely locally. Just like in local development, I wanted to be able to run my infrastructure as code on my machine and run tests against it before deploying it to a real world AWS environment. This would allow me to test things in a free and secure way.

In this post I will demonstrate this by deploying an aws lambda function with a function url, but the same technique can be used to deploy any infrastructure supported by localstack.

## Prerequisites

- [docker](https://hub.docker.com/)
- [terraform](https://www.terraform.io/) (I'm using version 1.4.6)

## 1. Setting up the localstack environment

Create the following `docker-compose.yaml` file
```yaml
version: '3.4'
services:
  localstack:
    image: localstack/localstack:2.0.2
    ports:
      - '4566:4566'
    expose:
      - '4566'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

Note that we are mounting the docker socket as a volume. Localstack pulls external docker images in order to run the lambda runtime so this is required.

Now run this to start the container.

```bash
docker compose up -d
```

### Creating the state bucket

In a real world scenario, for your staging and production environments, you're going to want to share the terraform state so that deploys can be made from multiple machines easily. Terraform does not support different backend types for different environments, but we can use s3 to hold our state.

the localstack image ships with a local version of the aws cli which we can use to create the bucket.

```bash
docker compose exec localstack awslocal s3api create-bucket --bucket terraform-state
```

## 2. Setting up terraform

Create a directory to store your terraform files and add a `main.tf`

```hcl
variable "use_localstack" {
  type    = string
  default = true
}

terraform {
  backend "s3" {}
}

locals {
  aws_settings = (
    var.use_localstack ?
    {
      access_key = "fake"
      secret_key = "fake"

      skip_credentials_validation = true
      skip_metadata_api_check     = true
      skip_requesting_account_id  = true
      s3_use_path_style           = true

      override_endpoint = "http://localhost:4566"
      profile           = null
    } :
    {
      access_key                  = null
      secret_key                  = null
      skip_credentials_validation = null
      skip_metadata_api_check     = null
      skip_requesting_account_id  = null
      s3_use_path_style           = null

      override_endpoint = null
    }
  )
  archive_file = "build.zip"
}


provider "aws" {
  access_key                  = local.aws_settings.access_key
  secret_key                  = local.aws_settings.secret_key
  region                      = "eu-west-1"
  s3_use_path_style           = local.aws_settings.s3_use_path_style
  skip_credentials_validation = local.aws_settings.skip_credentials_validation
  skip_metadata_api_check     = local.aws_settings.skip_metadata_api_check
  skip_requesting_account_id  = local.aws_settings.skip_requesting_account_id
  dynamic "endpoints" {
    for_each = local.aws_settings.override_endpoint[*]
    content {
      lambda   = endpoints.value
      iam      = endpoints.value
    }
  }
}
```

This set up allows us to easily switch between localstack and the real AWS using the `use_localstack` terraform variable. Note that by setting the various settings to `null` we are telling terraform to use the defaults. If you are using more aws services, you will need to override the endpoints like we've done for `lambda` and `iam` here.

Now that you have this set up, create a backend configuration for localstack in your terraform directory, create a file called `local.s3.tfbackend` pointing at the s3 bucket we made earlier.

The `force_path_style` property is required to work with s3 locally without additional hosts configuration.

```hcl
region = "eu-west-1"
bucket = "terraform-state"
key = "my-app.tfstate"
endpoint = "http://localhost:4566"
sts_endpoint = "http://localhost:4566"
force_path_style = true
```

You should now be able to initialise terraform

```bash
terraform -chdir=./terraform init -backend-config=./local.s3.tfbackend
```

## 3. Creating your infrastructure

Now you can start defining infrastructure in your `main.tf` file.

In this example I'm creating a lambda function with a simple function url.

```hcl
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "iam_for_lambda" {
  name               = "redirects_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "../index.js"
  output_path = local.archive_file
}

resource "aws_lambda_function" "redirect_lambda" {
  filename      = local.archive_file
  function_name = "my-function"
  role          = aws_iam_role.iam_for_lambda.arn
  handler       = "index.main"

  source_code_hash = data.archive_file.lambda.output_base64sha256

  runtime = "nodejs18.x"

  environment {
    variables = {
      NODE_OPTIONS = "--enable-source-maps"
    }
  }
}

resource "aws_lambda_function_url" "lambda_url" {
  function_name      = aws_lambda_function.redirect_lambda.function_name
  authorization_type = "NONE"
}
```

This will deploy the infrastructure for a lambda function from a file called `index.js` in the root.

```javascript
exports.main = async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      message: 'Hello World!'
    }
  };
};
```

Now run terraform plan and apply your changes

```shell
terraform -chdir=./terraform plan -out terraform.plan && \
terraform -chdir=./terraform apply terraform.plan
```

You should now have your lambda function deployed.

## 4. Invoking your function

To get the url for your lambda function, inspect the state

```shell
terraform -chdir=./terraform state show aws_lambda_function_url.lambda_url
```

This will return you information about the resource including the `function_url`

```hcl
# aws_lambda_function_url.lambda_url:
resource "aws_lambda_function_url" "lambda_url" {
    authorization_type = "NONE"
    function_arn       = "arn:aws:lambda:eu-west-1:000000000000:function:my-function"
    function_name      = "my-function"
    function_url       = "http://e6iu1sghet0ujaq6757ukxsjo6h50t90.lambda-url.eu-west-1.localhost.localstack.cloud:4566/"
    id                 = "my-function"
    url_id             = "e6iu1sghet0ujaq6757ukxsjo6h50t90"
}
```

you can then call the function

```shell
curl -v http://e6iu1sghet0ujaq6757ukxsjo6h50t90.lambda-url.eu-west-1.localhost.localstack.cloud:4566/ 
```

### ⚠️ Status code issu️e ⚠️ 

As good as localstack is, it's not a 100% true implementation of AWS. At time of writing there is [an issue](https://github.com/localstack/localstack/issues/8213) where function urls will always return a 200 http status even when the lambda code explicitly sets a different status code. In a real AWS environment, the proper status code is returned.

## 4. Going live in AWS

Now that you have your infra and production code tested locally you're ready to go to a real AWS environment. In your `terraform` directory create a new backend configuration called `production.s3.tfbackend`

```hcl
region = "eu-west-1"
bucket = "terraform-state-production"
key = "my-function.tfstate"
```

*Ensure you've created the state bucket in aws first*

Reinitialise terraform for this backend

```shell
terraform -chdir=./terraform init \
  -backend-config=./production.s3.tfbackend \
  -reconfigure
```

Deploy your infrastructure setting the `use_localstack` variable to `false`.

```
terraform -chdir=./terraform plan \
  -var 'use_localstack=false' \
  -out terraform.plan && \
terraform -chdir=./terraform apply \
  -var 'use_localstack=false' terraform.plan
```

You should now be able to repeat exactly the same steps as you made locally to run your function.

## References

- [Terraform override local provider for use with localstack](https://stackoverflow.com/a/69731567/752756)
- [Localstack terraform documentation](https://docs.localstack.cloud/user-guide/integrations/terraform/)